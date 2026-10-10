"""HuggingFace sequence-classifier detector — bring your own fine-tuned model.

BYOM (bring your own model): point it at any text-classification model on
the Hub known to distinguish AI-generated from human text — e.g. fine-tuned
RoBERTa/DeBERTa detectors trained on HC3 or similar corpora.

The auto label-mapper accepts common label conventions:
* {"LABEL_1"|"fake"|"ai"|"machine"|"generated"|"chatgpt"|"llm"} -> AI class
* everything else ({LABEL_0, "human", "real", ...}) -> human class

Long texts are scored per-sentence (cheap forward passes) and aggregated.
Sentence probabilities power the heatmap directly.
"""
from __future__ import annotations

import asyncio
import re

from ..schemas import Availability, EvidenceItem
from .base import AnalysisContext, BaseDetector, DetectorError, RawOutcome, \
    RawSegment
from .lm_common import ml_status, ml_requirement_hint

AI_LABEL_HINTS = ("fake", "ai", "machine", "generated", "chatgpt", "llm",
                  "artificial", "synthetic", "robot")
DEFAULT_MODEL = ""   # must be set explicitly — no surprise downloads


_PIPELINE_CACHE: dict = {}
_OV_CACHE: dict = {}


def _ov_model_dir(model_id: str, settings: dict):
    """Return the OpenVINO IR directory for a model, or None."""
    import os
    explicit = (settings.get("ov_model_dir") or "").strip()
    if explicit and os.path.isfile(os.path.join(explicit, "openvino_model.xml")):
        return explicit
    home = os.environ.get("AITEXTJURY_HOME", "/data")
    safe = re.sub(r"[^a-zA-Z0-9]", "_", model_id).strip("_")
    cand = os.path.join(home, "models", safe, "openvino_model.xml")
    if os.path.isfile(cand):
        return os.path.dirname(cand)
    cand2 = os.path.join(home, "models", "aigc_zhv3_ov", "openvino_model.xml")
    if os.path.isfile(cand2):
        return os.path.dirname(cand2)
    return None


def _load_ov(model_id: str, ov_dir: str):
    """Load (and cache) tokenizer + compiled OpenVINO model + id2label."""
    import json, os
    key = (model_id, ov_dir)
    hit = _OV_CACHE.get(key)
    if hit is not None:
        return hit
    import openvino as ov
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(ov_dir)
    core = ov.Core()
    compiled = core.compile_model(os.path.join(ov_dir, "openvino_model.xml"), "CPU")
    id2label = None
    jp = os.path.join(ov_dir, "id2label.json")
    if os.path.isfile(jp):
        id2label = json.load(open(jp, encoding="utf-8"))
    if not id2label:
        n_out = 2
        try:
            _co2 = compiled.outputs
            _o = _co2() if callable(_co2) else _co2
            n_out = int(_o[0].get_partial_shape()[1])
        except Exception:
            pass
        id2label = {str(i): "LABEL_%d" % i for i in range(n_out)}
    _OV_CACHE[key] = (tok, compiled, id2label)
    return _OV_CACHE[key]


def _softmax(logits):
    import math
    m = max(logits)
    exps = [math.exp(x - m) for x in logits]
    s = sum(exps) or 1.0
    return [e / s for e in exps]



class HFClassifierDetector(BaseDetector):
    id = "hf_classifier"
    name = "HF Classifier (BYOM)"
    family = "classifier"
    description = (
        "Any HuggingFace text-classification model you choose (e.g. HC3-style "
        "RoBERTa detectors). Model id set via detector settings; nothing is "
        "downloaded until you configure one.")
    link = "https://huggingface.co/models?pipeline_tag=text-classification&search=chatgpt"
    requires = ["torch", "transformers"]
    default_enabled = True
    heavy = True
    robustness = "low"
    robustness_note = "易被改写绕过"
    DEFAULT_BANDS = (0.5, 0.2)

    def raw_direction(self) -> str:
        return "higher_is_ai"

    def availability(self, ctx: AnalysisContext | None = None) -> Availability:
        ok, err = ml_status()
        if not ok:
            return Availability(
                ok=False, reason=f"missing optional ML deps: {err}",
                hints=[ml_requirement_hint()])
        settings = (ctx.det_settings(self.id) if ctx else {}) or {}
        if not settings.get("model"):
            return Availability(
                ok=False,
                reason="no model configured — set detector setting "
                        "`hf_classifier.model` to a Hub id",
                hints=['example: model = "Hello-SimpleAI/chatgpt-detector-roberta"'])
        return Availability(ok=True)

    async def analyze(self, ctx: AnalysisContext) -> RawOutcome:
        try:
            return await asyncio.to_thread(self._analyze_sync, ctx)
        except DetectorError:
            raise
        except Exception as e:
            raise DetectorError(f"{type(e).__name__}: {e}") from e

    # ------------------------------------------------------------ sync path --

    def _ov_predict_batch(self, texts, tok, compiled, id2label):
        """Run one OpenVINO batch -> list of P(AI) via shared label logic."""
        enc = tok(texts, padding=True, truncation=True, max_length=512,
                  return_tensors="np")
        # map compiled inputs by name (robust to input order/count)
        avail = {k: enc[k] for k in enc}
        _ci = compiled.inputs
        comp_inputs = _ci() if callable(_ci) else _ci
        inputs = {}
        for inp in comp_inputs:
            names = {inp.get_any_name()}
            try:
                names.update(inp.get_names())
            except Exception:
                pass
            hit = next((avail[k] for k in names if k in avail), None)
            if hit is not None:
                inputs[inp] = hit
        out = compiled(inputs)
        _co = compiled.outputs
        _outs = _co() if callable(_co) else _co
        logits = out[_outs[0]]
        probs = [_softmax(list(row)) for row in logits]
        names = [id2label[str(i)] for i in range(len(probs[0]))]
        scores = []
        for p in probs:
            entries = [{"label": n, "score": float(v)}
                       for n, v in zip(names, p)]
            entries.sort(key=lambda e: -e["score"])
            ai_lab = self._pick_ai_label(entries)
            if ai_lab is None:
                scores.append(0.5)
                continue
            hit = next((e for e in entries
                        if str(e["label"]).lower() == ai_lab), None)
            scores.append(float(hit["score"]) if hit else 0.5)
        return scores

    def _analyze_sync(self, ctx: AnalysisContext) -> RawOutcome:
        settings = ctx.det_settings(self.id)
        model_id = settings.get("model")
        if not model_id:
            raise DetectorError("hf_classifier.model not configured")

        try:
            from transformers import pipeline
        except Exception as e:
            raise DetectorError(f"transformers unavailable: {e}")

        try:
            import torch
            device = 0 if torch.cuda.is_available() else -1
        except Exception:
            device = -1

        use_ov = False
        ov_bundle = None
        ov_dir = _ov_model_dir(model_id, settings)
        if ov_dir:
            try:
                ov_bundle = _load_ov(model_id, ov_dir)
                use_ov = True
            except Exception:
                use_ov = False  # fall through to torch pipeline
        clf = None
        if not use_ov:
            try:
                clf = _PIPELINE_CACHE.get(model_id)
                if clf is None:
                    clf = pipeline("text-classification", model=model_id,
                                   device=device, top_k=2)
                    _PIPELINE_CACHE[model_id] = clf
            except Exception as e:
                raise DetectorError(
                    f"failed to load '{model_id}': {e}. Check the model id and "
                    "that it is a text-classification model.")

        sentences = ctx.segmentation.sentences
        # 长文限流：最多100句均匀采样，避免CPU超时
        MAX_SENTS = 100
        if len(sentences) > MAX_SENTS:
            _step = len(sentences) / MAX_SENTS
            sentences = [sentences[int(i * _step)] for i in range(MAX_SENTS)]
        # the model knows its max length; batches of sentences, 512 safer
        n = len(sentences)
        results: list[float] = [0.5] * n
        ai_label = None
        errors = 0

        def _p_ai_from_out(out):
            nonlocal ai_label
            if isinstance(out, list):   # top_k=2 -> list of dicts
                ai_label = ai_label or self._pick_ai_label(out)
                entry = next((e for e in out
                              if e["label"].lower() == ai_label), None)
                return float(entry["score"]) if entry else 0.5
        # 长文限流：最多取100句（均匀采样），避免CPU超时
        MAX_SENTS = 100
        if len(sentences) > MAX_SENTS:
            step = len(sentences) / MAX_SENTS
            sentences = [sentences[int(i * step)] for i in range(MAX_SENTS)]
            n = len(sentences)
        todo_idx, todo_txt = [], []
        for i, sent in enumerate(sentences):
            t = sent.text.strip()
            if t:
                todo_idx.append(i)
                todo_txt.append(t[:4000])
            # empty text -> stays 0.5
        BATCH = 32
        for b in range(0, len(todo_txt), BATCH):
            idxs = todo_idx[b:b + BATCH]
            txts = todo_txt[b:b + BATCH]
            try:
                if use_ov:
                    tok, compiled, id2label = ov_bundle
                    ov_scores = self._ov_predict_batch(txts, tok, compiled,
                                                       id2label)
                    for ii, sc in zip(idxs, ov_scores):
                        results[ii] = sc
                else:
                    outs = clf(txts, truncation=True)
                    if isinstance(outs, dict):
                        outs = [outs]
                    for ii, out in zip(idxs, outs):
                        try:
                            results[ii] = _p_ai_from_out(out)
                        except Exception:
                            errors += 1  # stays 0.5
            except Exception:
                errors += len(idxs)  # all stay 0.5
        if errors == n:
            raise DetectorError("classifier failed on every sentence")

        p_ai_mean = sum(results) / max(1, n)
        ranked = sorted(zip(sentences, results), key=lambda t: -t[1])[:5]

        signals = {
            "p_ai_mean": p_ai_mean,
            "sentences": len(results),
            "failed_sentences": errors,
            "backend": "openvino" if use_ov else "torch",
            "model": model_id,
        }
        evidence = [
            EvidenceItem(
                title="classifier probability",
                detail=(f"{model_id}: mean P(AI)={p_ai_mean:.2f} across "
                        f"{len(results)} sentences "
                        f"(AI class: '{ai_label or 'auto'})."),
                severity="high" if p_ai_mean > 0.8 else
                         ("warn" if p_ai_mean > 0.6 else "info")),
        ]
        if ranked:
            s_top, p_top = ranked[0]
            evidence.append(EvidenceItem(
                title="most suspicious sentence",
                detail=f"P={p_top:.2f} — “{s_top.text.strip()[:100]}”",
                severity="warn"))
        seg_scores = [RawSegment(segment_id=s.id, value=p)
                      for s, p in zip(sentences, results)]
        return RawOutcome(
            raw_score=p_ai_mean,
            raw_direction="higher_is_ai",
            signals=signals,
            segment_scores=seg_scores,
            evidence=evidence,
            model=model_id,
            reference_note=("Fine-tuned classifiers transfer poorly across "
                            "domains and models; calibrate on your own data."))

    # ------------------------------------------------------------ helpers --

    def _pick_ai_label(self, entries) -> str | None:
        labs = [str(e.get("label", "")).lower() for e in entries]
        if len(labs) != 2:
            return None
        for lab in labs:
            stem = lab.replace("label_", "")
            if any(h in stem for h in AI_LABEL_HINTS):
                return lab
        # LABEL_1 assumed AI, LABEL_0 human (common convention)
        if labs == ["label_0", "label_1"]:
            return "label_1"
        return None

    def _scalar_p_ai(self, out: dict) -> float:
        lab = str(out.get("label", "")).lower()
        stem = lab.replace("label_", "")
        if any(h in stem for h in AI_LABEL_HINTS) or lab == "label_1":
            return float(out.get("score", 0.5))
        return 1.0 - float(out.get("score", 0.5))

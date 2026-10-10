<h1 align="center">Tribunal</h1>

<p align="center">
  <strong>A jury of AI-text detectors. You are the judge.</strong>
</p>

<p align="center">
  Paste text, run many independent detection methods side by side,<br />
  look at the evidence before forming any opinion.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-1f6feb?style=for-the-badge" alt="MIT license" />
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/kofwj/Tribunal?style=flat-square&color=ffd33d&logo=github" alt="Stars" />
  <img src="https://img.shields.io/github/forks/kofwj/Tribunal?style=flat-square&color=8957e5&logo=github" alt="Forks" />
  <img src="https://img.shields.io/github/last-commit/kofwj/Tribunal?style=flat-square&color=3fb950&logo=github" alt="Last commit" />
</p>

<p align="center">
  <strong>English</strong> · <a href="README-zh.md">简体中文</a>
</p>

---

> [!NOTE]
> This is a Chinese-localized fork of [YiCQi/AITextJury](https://github.com/YiCQi/AITextJury).
> Full Chinese README: [README-zh.md](README-zh.md). 中文定制版说明见 [CHANGELOG-zh.md](CHANGELOG-zh.md).

## What it does

Not "yet another AI detector" that prints one unreliable percentage. Think of it as a
VirusTotal-style workbench for AI-generated text: anyone can write a detector plugin,
plug it in, and compare methods openly.

```
┌─────────────────────────────────────────────────────────────────┐
│                     AITextJury Workbench                        │
│  text ─▶ segmenter ─▶ detectors (parallel, cached) ─▶ consensus │
└───────────┬──────────────────────────────────────────────────────┘
            │
   ┌────────┴────────────────────────────────────────────┐
   │ Detector API  (every detector returns the same shape)│
   └────────┬────────────────────────────────────────────┘
        ┌────┴─────┬─────────────┬────────────┬─────────────┐
   stylometry  local-LM      classifier   LLM-Judge      your
   (stats)   perplexity /   (BYOM, HF)   (BYOK: OpenAI, plugins
             Fast-DetectGPT /          Gemini, DeepSeek, (plugins/)
             Binoculars                Ollama, anything)
```

## Quickstart

```bash
git clone https://github.com/kofwj/Tribunal.git
cd aitextjury-zh
docker compose up
# → http://localhost:8000
```

<details>
<summary>Local dev (without Docker)</summary>

Requires [Python 3.10+](https://www.python.org/downloads/) and Node 18+.

```bash
# Windows (PowerShell)
scripts\setup.ps1 -Ml     # one-time: private venv + all deps incl. torch
scripts\dev.ps1           # workbench at http://localhost:5173, API at :8000

# Linux / macOS
./scripts/setup.sh --with-ml
./scripts/dev.sh
```

* **Why the flag**: without `-Ml` / `--with-ml` you get a light install (no torch) and the four LM-based detectors stay `unavailable` — each shows the fix command on its panel card.
* If HuggingFace is blocked, set `HF_ENDPOINT=https://hf-mirror.com` first. After that everything runs offline.
</details>

## Using the workbench

Paste text in the **Workbench** tab, tick detectors, hit **Analyze**, then read the page top-to-bottom:

1. **Consensus** — the calibration-weighted vote across detectors. When detectors disagree, the notes say who said what; disagreement is information, not a bug.
2. **Detector cards** — every `score` is normalized so **higher = more AI**, always. Raw values keep their native direction and each card states it.
3. **Heatmap** — which *parts* of the text look AI, per sentence/paragraph.
4. **Evidence chips** — the quotable numbers behind the verdict: perplexity, burstiness, stock-phrase hits…

The other tabs:

* **Providers** — paste any OpenAI-compatible or Gemini key to enable the **LLM Judge**. Keys stay in the local `data/providers.json`, masked on screen.
* **Calibration** — drop labeled samples into `data/bench/*.jsonl` and hit **Recalibrate**: each detector gets an honest AUC / accuracy, and consensus weights follow measured quality.
* **Methodology** — what each detector measures and what it is blind to.

> Privacy: everything except the LLM Judge runs **on your machine** — text, history and keys never leave it. Point the Judge at a local Ollama/vLLM and AITextJury is fully offline.

## The detector panel

| detector | type | needs | idea |
|---|---|---|---|
| **Stylometry** | local stats | nothing | burstiness, repetition profile, connective boilerplate, LLM-register "tells" (EN+ZH) |
| **LLM Perplexity** | local LM | torch+transformers | mean per-token surprisal under a small causal LM |
| **Fast-DetectGPT** | local LM | torch+transformers | conditional probability curvature ([Bao et al., ICLR'24](https://arxiv.org/abs/2310.05130)) |
| **Binoculars** | local LM pair | torch+transformers | performer/observer cross-model agreement ([Hans et al. 2024](https://arxiv.org/abs/2401.12070)) |
| **HF Classifier** | BYOM | torch+transformers | any HuggingFace text-classification model you choose |
| **LLM Judge** | BYOK | a provider key or local Ollama | your LLM judges with a strict-JSON protocol |
| **Plugins** | community | anything | e.g. the bundled `length_rhythm` example |

## Honest limitations

* **Adversarial text defeats detectors.** Rewritten, paraphrased or human-edited AI text genuinely overlaps with polished human text. AITextJury surfaces evidence and lets humans decide — it must not be used as proof, or to accuse students/authors.
* Local-LM detectors default to small English-centric models (`gpt2`); for Chinese point them at multilingual models via detector settings.
* Scores are probabilities only as far as their calibration says.

## What's different in this fork

See [CHANGELOG-zh.md](CHANGELOG-zh.md) (in Chinese). Highlights:

* Full Chinese UI + visual redesign
* Fixed upstream `availability(ctx=None)` bug (detectors with configured models showed as unavailable)
* HF Classifier batch inference + in-process model cache (177 sentences: 89s → 0.7s/6 sentences warm)
* CPU-only torch by default, `HF_ENDPOINT` mirror support
* Recommended Chinese model: `yuchuantian/AIGC_detector_zhv3` (ICLR'24 MPU)

## Related work

* [baoguangsheng/fast-detect-gpt](https://github.com/baoguangsheng/fast-detect-gpt) (434★) · [ahans30/Binoculars](https://github.com/ahans30/Binoculars) (421★)
* [YuchuanTian/AIGC_text_detector](https://github.com/YuchuanTian/AIGC_text_detector) (472★) — MPU multiscale detection (ICLR'24 spotlight)
* [lynote-ai/ai-text-detector](https://github.com/lynote-ai/ai-text-detector) (445★) — local, cautious, explainable

## License

MIT — see [LICENSE](LICENSE). Detector methods belong to their authors and papers.

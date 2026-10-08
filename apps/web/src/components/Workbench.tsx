import { useEffect, useRef, useState } from "react";
import type { AnalyzeReport, DetectorInfo } from "../types";
import { analyze, fetchDetectors, fetchSettings, saveSettings } from "../api";
import { Heatmap } from "./Heatmap";
import { DetectorCard } from "./DetectorCard";
import { Gauge } from "./Gauge";
import { fmtPct, detectorName, detectorDesc } from "../util";

/** 检测工作台 v2：输入通栏置顶 → 检测器窄列 + 综合判定 → 热力图 → 详情卡 */
export function Workbench() {
  const [text, setText] = useState("");
  const [detectors, setDetectors] = useState<DetectorInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const [hfModel, setHfModel] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { detectors } = await fetchDetectors();
        setDetectors(detectors);
        setSelected(new Set(detectors.filter(d => d.default_enabled).map(d => d.id)));
        try {
          const { settings } = await fetchSettings();
          const m = (settings as any)?.detectors?.hf_classifier?.model;
          if (m) setHfModel(m);
        } catch { /* ignore */ }
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const run = async () => {
    if (!text.trim() || selected.size === 0) return;
    setRunning(true);
    setError(null);
    try {
      const ids = [...selected];
      const rep = await analyze(text, ids);
      setReport(rep);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const nw = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div>
      {/* ── ① 输入区：通栏置顶 ─────────────────────────────── */}
      <div className="panel">
        <h3>待检测文本</h3>
        <p className="hint">
          粘贴文章、章节、评论……都可以。全部在本机运行
          （只有你启用的 LLM 裁判会调外部接口）。
        </p>
        <textarea
          className="main"
          value={text}
          placeholder={"把文字粘贴到这里…\n\n空行分段，按标点分句（支持中文 。！？）。"}
          onChange={(e) => setText(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
          <button className="primary" disabled={running || !text.trim() || selected.size === 0}
            onClick={run}>
            {running ? (<><span className="spin" />检测中…</>) : "开始检测"}
          </button>
          <button className="ghost" disabled={running || !text}
            onClick={() => setText("")}>
            清空
          </button>
          <span className="num" style={{ marginLeft: 8 }}>
            {text.length} 字 · {nw} 词
          </span>
          {report && (
            <span className="num" style={{ marginLeft: "auto" }}>
              上次用时 {report.duration_ms} ms
            </span>
          )}
        </div>
        {error && (
          <div style={{ color: "var(--warn)", marginTop: 12, fontSize: 12.5 }}>
            {error}
          </div>
        )}
      </div>

      {/* ── ② 检测器窄列 + ③ 综合判定 ─────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "300px 1fr",
        gap: 16, marginTop: 16, alignItems: "start",
      }}>
        <DetectorPanel detectors={detectors} selected={selected} onToggle={toggle}
          hfModel={hfModel} onModelChange={setHfModel} />

        <div ref={resultRef} style={{ scrollMarginTop: 16 }}>
          {!report ? (
            <div className="panel" style={{
              textAlign: "center", color: "var(--text-faint)",
              minHeight: 280, display: "flex", flexDirection: "column",
              justifyContent: "center",
            }}>
              <h3>检测结果</h3>
              <p>
                还没有检测。AITextJury 会展示每个检测器的分数
                <i>和证据</i>——热力图、困惑度、校准状态，
                而不是一个看不懂的百分比。
              </p>
            </div>
          ) : (
            <div className="panel">
              <div className="label">综合判定</div>
              <div className="gauge-wrap">
                <Gauge score={report.consensus.score}
                  verdict={report.consensus.verdict}
                  threshold={0.5}
                  size={1.1} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="kv">
                    <span className="k">一致度</span>
                    <span className="v">{fmtPct(report.consensus.agreement)}（检测器之间）</span>
                  </div>
                  <div className="kv">
                    <span className="k">检测器</span>
                    <span className="v">
                      {report.consensus.contributors.length} 个参与 ·{" "}
                      {report.results.filter((r) => r.error).length} 个失败
                    </span>
                  </div>
                  {report.consensus.contributors.map((c) => (
                    <div className="kv" key={c.detector_id}>
                      <span className="k">{detectorName(c.detector_id, c.detector_id)}</span>
                      <span className="v">
                        {c.score.toFixed(2)} · 权重 {c.weight.toFixed(2)} ·{" "}
                        <span style={{ color: c.calibrated ? "var(--ok)" : "var(--warn)" }}>
                          {c.calibrated ? "已校准" : "未校准"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {report.consensus.notes.length > 0 && (
                <ul className="notes">
                  {report.consensus.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>
          )}
          {report && (
            <div style={{ marginTop: 16 }}>
              <Heatmap report={report} />
            </div>
          )}
        </div>
      </div>

      {/* ── ④ 各检测器详情：通栏网格 ───────────────────────── */}
      {report && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="label">各检测器</div>
          <div className="result-grid">
            {report.results.map((r) => (
              <DetectorCard key={r.detector_id} result={r} />
            ))}
          </div>
        </div>
      )}

      {/* ── 运行信息 ───────────────────────────────────────── */}
      {report && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="label">运行信息</div>
          <button className="ghost" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? "隐藏" : "查看"}原始 JSON
          </button>
          {showRaw && (
            <pre className="raw" style={{ marginTop: 12 }}>
              {JSON.stringify(report, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

const HF_MODELS = [
  { id: "yuchuantian/AIGC_detector_zhv3", label: "中文 v3（推荐）" },
  { id: "yuchuantian/AIGC_detector_zhv2", label: "中文 v2" },
  { id: "Hello-SimpleAI/chatgpt-detector-roberta-chinese", label: "旧版中文" },
];

function DetectorPanel({ detectors, selected, onToggle, hfModel, onModelChange }:
{
  detectors: DetectorInfo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  hfModel: string;
  onModelChange: (m: string) => void;
}) {
  const [editingModel, setEditingModel] = useState(false);
  const [modelInput, setModelInput] = useState("");

  const saveModel = async (modelId: string) => {
    const id = modelId.trim();
    if (!id) return;
    try {
      await saveSettings({ detectors: { hf_classifier: { model: id } } } as any);
      onModelChange(id);
      setEditingModel(false);
    } catch (e) {
      alert("保存失败：" + String(e));
    }
  };
  const available = detectors.filter((d) => d.available);
  const allOn = available.length > 0 && available.every((d) => selected.has(d.id));
  const toggleAll = () => {
    if (allOn) {
      available.forEach((d) => { if (selected.has(d.id)) onToggle(d.id); });
    } else {
      available.forEach((d) => { if (!selected.has(d.id)) onToggle(d.id); });
    }
  };
  // 已选中的浮到上面，未选中的沉底（各自保持后端顺序）
  const sorted = [...detectors].sort((a, b) =>
    Number(selected.has(b.id)) - Number(selected.has(a.id)));

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>检测器</h3>
        <span className="chip" style={{ marginLeft: 8 }}>
          {selected.size}/{detectors.length}
        </span>
      </div>
      <p className="hint" style={{ margin: "8px 0 12px" }}>
        组合多种独立方法，结果互相印证。
      </p>
      <div className="det-picker">
        {sorted.map((d) => {
          const on = selected.has(d.id);
          return (
            <div key={d.id}>
              <label
                className={`det-opt${on ? " on" : ""}${d.available ? "" : " off"}`}
                data-tip={d.available ? detectorDesc(d.id, d.description) : d.reason}>
                <input type="checkbox" checked={on} disabled={!d.available}
                  onChange={() => onToggle(d.id)} />
                <span className="det-opt-name">{detectorName(d.id, d.name)}</span>
                <span className={`dot ${d.available ? (d.uncalibrated ? "warn" : "ok") : "off"}`} />
              </label>
              {d.id === "hf_classifier" && d.available && (
                <div style={{ margin: "6px 0 2px 26px" }}>
                  {!editingModel ? (
                    <button
                      onClick={() => { setModelInput(hfModel); setEditingModel(true); }}
                      title="点击更换模型"
                      style={{
                        background: "none", border: "none", padding: 0,
                        fontSize: 11, color: "var(--text-faint)",
                        cursor: "pointer", fontFamily: "var(--mono)",
                        maxWidth: "100%", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {"\u2699 "}{hfModel ? hfModel.split("/").pop() : "选择模型"}
                      </button>
                  ) : (
                    <div>
                      <select
                        value={HF_MODELS.some(m => m.id === modelInput) ? modelInput : "__custom"}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v !== "__custom") { void saveModel(v); }
                        }}
                        style={{ width: "100%", fontSize: 12, marginBottom: 6 }}>
                        {HF_MODELS.map(m => (
                          <option key={m.id} value={m.id}>{m.label} — {m.id}</option>
                        ))}
                        <option value="__custom">自定义…</option>
                      </select>
                      {(!HF_MODELS.some(m => m.id === modelInput)) && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            type="text" value={modelInput}
                            onChange={(e) => setModelInput(e.target.value)}
                            placeholder="HuggingFace 模型 ID"
                            style={{ flex: 1, fontSize: 12, padding: "6px 8px" }}
                          />
                          <button className="ghost" style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => void saveModel(modelInput)}>
                            确定
                          </button>
                          <button className="ghost" style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => setEditingModel(false)}>
                            取消
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="ghost" onClick={toggleAll}
        style={{ width: "100%", marginTop: 12, fontSize: 12 }}>
        {allOn ? "清空" : "全选"}
      </button>
      <div className="det-legend">
        <span><i className="dot ok" />已校准</span>
        <span><i className="dot warn" />未校准</span>
        <span><i className="dot off" />不可用</span>
      </div>
    </div>
  );
}

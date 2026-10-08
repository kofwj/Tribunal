import { useEffect, useState } from "react";
import type { AnalyzeReport, DetectorInfo } from "../types";
import { analyze, fetchDetectors } from "../api";
import { Heatmap } from "./Heatmap";
import { DetectorCard } from "./DetectorCard";
import { Gauge } from "./Gauge";
import { fmtPct, detectorName, detectorDesc } from "../util";

/** 检测工作台：输入 → 检测器选择 → 运行 → 看证据 */
export function Workbench() {
  const [text, setText] = useState("");
  const [detectors, setDetectors] = useState<DetectorInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { detectors } = await fetchDetectors();
        setDetectors(detectors);
        setSelected(new Set(detectors.filter(d => d.default_enabled).map(d => d.id)));
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
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const nw = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.25fr 2fr", gap: 18, alignItems: "start" }}>
      {/* ------------------------------------------------- 左：输入栏 */}
      <div>
        <div className="panel">
          <h3>待检测文本</h3>
          <p className="hint">
            粘贴文章、章节、评论……都可以。全部在本机运行
            （只有你启用的自带 LLM 裁判会调外部接口）。
          </p>
          <textarea
            className="main"
            value={text}
            placeholder={"把文字粘贴到这里…\n\n空行分段，按标点分句（支持中文 。！？）。"}
            onChange={(e) => setText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 14, marginTop: 10,
                       color: "var(--text-faint)", fontSize: 12 }}>
            <span>{text.length} 字</span>
            <span>{nw} 词</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <button className="primary" disabled={running || !text.trim() || selected.size === 0}
              onClick={run}>
              {running ? (<><span className="spin" />检测中…</>) : "开始检测"}
            </button>
            <button className="ghost" disabled={running || !text}
              onClick={() => setText("")}>
              清空
            </button>
            {report && (
              <span style={{ color: "var(--text-faint)", fontSize: 12 }}>
                上次用时 {report.duration_ms} ms
              </span>
            )}
          </div>
          {error && (
            <div style={{ color: "var(--warn)", marginTop: 10, fontSize: 12.5 }}>
              {error}
            </div>
          )}
        </div>

        <DetectorPanel detectors={detectors} selected={selected}
          onToggle={toggle} />
      </div>

      {/* --------------------------------------------------- 右：结果 */}
      <div>
        {!report && (
          <div className="panel" style={{ textAlign: "center", color: "var(--text-faint)" }}>
            <h3>检测结果</h3>
            <p style={{ minHeight: 120 }}>
              还没有检测。AITextJury 会展示每个检测器的分数
              <i>和证据</i>——热力图、困惑度、校准状态，
              而不是一个看不懂的百分比。
            </p>
          </div>
        )}
        {report && (
          <>
            <div className="panel">
              <h3>综合判定</h3>
              <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                <Gauge score={report.consensus.score}
                  verdict={report.consensus.verdict}
                  threshold={0.5}
                  size={1.18} />
                <div style={{ flex: 1, minWidth: 260 }}>
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
                        <span style={{ color: c.calibrated ? "var(--accent)" : "var(--warn)" }}>
                          {c.calibrated ? "已校准" : "未校准"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {report.consensus.notes.length > 0 && (
                <ul className="notes" style={{ marginTop: 10 }}>
                  {report.consensus.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </div>

            <Heatmap report={report} />

            <div className="panel">
              <h3>各检测器</h3>
              <div className="result-grid">
                {report.results.map((r) => (
                  <DetectorCard key={r.detector_id} result={r} />
                ))}
              </div>
            </div>

            <div className="panel">
              <h3>运行信息</h3>
              <button className="ghost" onClick={() => setShowRaw(!showRaw)}>
                {showRaw ? "隐藏" : "查看"}原始 JSON
              </button>
              {showRaw && (
                <pre style={{
                  maxHeight: 360, overflow: "auto", fontSize: 11,
                  background: "var(--bg-soft)", padding: 12, borderRadius: 8,
                }}>
                  {JSON.stringify(report, null, 2)}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetectorPanel({ detectors, selected, onToggle }:
{
  detectors: DetectorInfo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const available = detectors.filter((d) => d.available);
  const allOn = available.length > 0 && available.every((d) => selected.has(d.id));
  const toggleAll = () => {
    if (allOn) {
      available.forEach((d) => { if (selected.has(d.id)) onToggle(d.id); });
    } else {
      available.forEach((d) => { if (!selected.has(d.id)) onToggle(d.id); });
    }
  };
  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>检测器</h3>
        <span className="chip" style={{ marginLeft: 8 }}>
          {selected.size}/{detectors.length} 已选
        </span>
        <button className="ghost" onClick={toggleAll}
          style={{ marginLeft: "auto", padding: "3px 12px", fontSize: 12 }}>
          {allOn ? "清空" : "全选"}
        </button>
      </div>
      <p className="hint" style={{ margin: "6px 0 10px" }}>
        组合多种独立方法，结果互相印证。
      </p>
      <div className="det-picker">
        {detectors.map((d) => {
          const on = selected.has(d.id);
          return (
            <label key={d.id}
              className={`det-opt${on ? " on" : ""}${d.available ? "" : " off"}`}
              title={d.available ? detectorDesc(d.id, d.description) : d.reason}>
              <input type="checkbox" checked={on} disabled={!d.available}
                onChange={() => onToggle(d.id)} />
              <span className="det-opt-name">{detectorName(d.id, d.name)}</span>
              <span className={`dot ${d.available ? (d.uncalibrated ? "warn" : "ok") : "off"}`} />
            </label>
          );
        })}
      </div>
      <div className="det-legend">
        <span><i className="dot ok" />已校准</span>
        <span><i className="dot warn" />未校准</span>
        <span><i className="dot off" />不可用</span>
      </div>
    </div>
  );
}

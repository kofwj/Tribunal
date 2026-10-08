import { useEffect, useRef, useState } from "react";
import type { AnalyzeReport, DetectorInfo } from "../types";
import { analyze, fetchDetectors } from "../api";
import { Heatmap } from "./Heatmap";
import { DetectorCard } from "./DetectorCard";
import { Gauge } from "./Gauge";
import { fmtPct, detectorName, detectorDesc , VERDICT_LABEL} from "../util";

/** 检测工作台 v3：输入通栏置顶 → 检测器窄列 +（综合判定 → 各检测器）→ 热力图沉底 */
export function Workbench() {
  const [text, setText] = useState("");
  const [detectors, setDetectors] = useState<DetectorInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

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

  const copyReport = async () => {
    if (!report) return;
    const lines: string[] = [];
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    lines.push("AI 文本检测报告");
    lines.push("====================");
    lines.push(`综合判定：${(report.consensus.verdict ? VERDICT_LABEL[report.consensus.verdict] : null) ?? report.consensus.verdict ?? "—"}（${report.consensus.score.toFixed(2)}）· 一致度 ${Math.round(report.consensus.agreement * 100)}%`);
    lines.push(`检测时间：${ts} · 文本 ${report.stats.chars} 字 · ${report.results.length} 个检测器`);
    lines.push("");
    lines.push("各检测器：");
    const sorted = [...report.results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    for (const r of sorted) {
      if (r.error) {
        lines.push(`• ${detectorName(r.detector_id, r.name)} — 出错：${r.error}`);
        continue;
      }
      const lbl = (r.verdict ? VERDICT_LABEL[r.verdict] : null) ?? r.verdict ?? "—";
      lines.push(`• ${detectorName(r.detector_id, r.name)} — ${(r.score ?? 0).toFixed(2)}（${lbl}）`);
      const det: string[] = [];
      if (r.model) det.push(`模型 ${r.model}`);
      if (r.calibration.status === "calibrated") det.push(`校准准确率 ${r.calibration.accuracy != null ? Math.round(r.calibration.accuracy*100)+"%" : "—"}`);
      det.push(`阈值 ${r.threshold.toFixed(2)}`, `用时 ${r.runtime_ms}ms`);
      lines.push(`  ${det.join(" · ")}`);
      // 关键证据
      const sigs = Object.entries(r.signals).filter(([,v]) => v != null && v !== "").slice(0, 3);
      for (const [k, v] of sigs) lines.push(`  ${k}：${typeof v === "number" && Number.isFinite(v) ? v.toFixed(3) : String(v)}`);
    }
    // ① 高风险句子（综合判定 top5）
    const topSegs = [...report.consensus.segment_scores]
      .filter(s => s.score != null)
      .sort((a, b) => (b.score as number) - (a.score as number))
      .slice(0, 5);
    if (topSegs.length) {
      lines.push("");
      lines.push("高风险句子（最像 AI 的 5 句）：");
      for (const ts of topSegs) {
        const seg = report.sentences.find(x => x.id === ts.id);
        const txt = seg ? seg.text.trim().replace(/\s+/g, " ") : "";
        const short = txt.length > 80 ? txt.slice(0, 80) + "…" : txt;
        lines.push(`• [${(ts.score as number).toFixed(2)}] ${short}`);
      }
    }
    // ② LLM 裁判理由
    const judge = report.results.find(r => r.detector_id === "llm_judge" && !r.error);
    if (judge) {
      const reasons: string[] = [];
      for (const sg of judge.segment_scores) {
        const rs = (sg.extras as any)?.reason;
        if (typeof rs === "string" && rs) reasons.push(rs);
      }
      // 去重
      const uniq = [...new Set(reasons)].slice(0, 5);
      if (uniq.length) {
        lines.push("");
        lines.push("LLM 裁判理由：");
        for (const rr of uniq) lines.push(`• ${rr.length > 200 ? rr.slice(0,200)+"…" : rr}`);
      }
    }
    // ③ 分歧说明
    const disag: string[] = [];
    for (const r of report.results) {
      if (!r.error && r.verdict !== report.consensus.verdict) {
        disag.push(`${detectorName(r.detector_id, r.name)}判为${(r.verdict ? VERDICT_LABEL[r.verdict] : null) ?? r.verdict ?? "—"}（${(r.score ?? 0).toFixed(2)}），与综合判定分歧`);
      }
    }
    if (disag.length) {
      lines.push("");
      lines.push("检测器分歧：");
      for (const d of disag) lines.push(`• ${d}`);
    }
    lines.push("");
    lines.push("注：AI 检测只能作为概率信号，不能证明作者身份。");
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard 可能不可用 */ }
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
        <DetectorPanel detectors={detectors} selected={selected} onToggle={toggle} />

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
              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                <div className="label" style={{ margin: 0 }}>综合判定</div>
                <button className="ghost" onClick={() => void copyReport()}
                  style={{ marginLeft: "auto", padding: "4px 12px", fontSize: 12 }}>
                  {copied ? "✓ 已复制" : "📋 复制报告"}
                </button>
              </div>
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
              <div className="label" style={{ marginBottom: 10 }}>各检测器 <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· 按分数排序</span></div>
              <div className="det-results-v3">
                {[...report.results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((r) => (
                  <DetectorCard key={r.detector_id} result={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ④ 热力图：沉底通栏 ─────────────────────────────── */}
      {report && (
        <div style={{ marginTop: 16 }}>
          <Heatmap report={report} />
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
            <label key={d.id}
              className={`det-opt${on ? " on" : ""}${d.available ? "" : " off"}`}
              data-tip={d.available ? detectorDesc(d.id, d.description) : d.reason}>
              <input type="checkbox" checked={on} disabled={!d.available}
                onChange={() => onToggle(d.id)} />
              <span className="det-opt-name">{detectorName(d.id, d.name)}</span>
              <span className={`dot ${d.available ? (d.uncalibrated ? "warn" : "ok") : "off"}`} />
            </label>
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

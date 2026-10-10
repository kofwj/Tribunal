import type { DetectorResult } from "../types";
import { detectorName, VERDICT_LABEL, verdictClass } from "../util";

/**
 * v3 检测器卡片：左侧色条表判定、大字分数、计量条、关键证据、复制按钮。
 */
export function DetectorCard({ result }: { result: DetectorResult }) {
  if (result.error) {
    return (
      <div className="det-card-v3">
        <div className="det-card-head">
          <span className="name">{detectorName(result.detector_id, result.name)}</span>
          <span className="verdict-tag" style={{ background: "var(--surface-3)", color: "var(--text-faint)" }}>出错</span>
        </div>
        <div style={{ color: "var(--warn)", fontSize: 12.5 }}>{result.error}</div>
      </div>
    );
  }

  const vc = verdictClass(result.verdict); // ai | human | mixed
  const label = (result.verdict ? VERDICT_LABEL[result.verdict] : null) ?? result.verdict ?? "—";
  const score = result.score ?? 0;
  const pct = Math.round(score * 100);

  // 关键证据：取前 3 个最有信息量的 signal
  const signals = Object.entries(result.signals)
    .filter(([, v]) => v != null && v !== "")
    .slice(0, 3);

  const copyOne = async () => {
    const lines = [
      `${detectorName(result.detector_id, result.name)} — ${score.toFixed(2)}（${label}）`,
      `阈值 ${result.threshold.toFixed(2)} · ${result.calibration.status === "calibrated" ? `已校准（AUC ${result.calibration.auc?.toFixed(2) ?? "—"}）` : "未校准"} · ${result.runtime_ms} ms`,
    ];
    if (result.model) lines.push(`模型：${result.model}`);
    for (const [k, v] of signals) lines.push(`${k}：${typeof v === "number" ? v.toFixed(3) : String(v)}`);
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { /* ignore */ }
    }
  };

  return (
    <div className={`det-card-v3 ${vc}`}>
      <div className="det-card-head">
        <span className="name">{detectorName(result.detector_id, result.name)}</span>
        <button className="copy-btn" onClick={copyOne} title="复制此检测器结果">📋</button>
        <span className={`verdict-tag ${vc}`}>{label}</span>
      </div>
      <div className="score-row">
        <span className={`score-big ${vc}`}>{score.toFixed(2)}</span>
        <span className="score-label">AI 概率 · 阈值 {result.threshold.toFixed(2)}</span>
      </div>
      <div className="meter">
        <div className={`meter-fill ${vc}`} style={{ width: `${pct}%` }} />
      </div>
      {(signals.length > 0 || result.model) && (
        <div className="evidence">
          {result.model && <div><span className="k">模型：</span>{result.model}</div>}
          {result.calibration.status === "calibrated" && (
            <div><span className="k">校准：</span>{result.calibration.dataset ?? ""} · 准确率 {result.calibration.accuracy != null ? `${Math.round(result.calibration.accuracy * 100)}%` : "—"}</div>
          )}
          {signals.map(([k, v]) => (
            <div key={k}><span className="k">{k}：</span>{typeof v === "number" && Number.isFinite(v) ? v.toFixed(3) : String(v)}</div>
          ))}
        </div>
      )}
      <div className="timing">{result.runtime_ms} ms · {result.segment_scores.length} 句已评分</div>
    </div>
  );
}

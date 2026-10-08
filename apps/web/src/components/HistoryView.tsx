import { useEffect, useState } from "react";
import { deleteHistoryReport, fetchHistory, fetchHistoryReport } from "../api";
import type { AnalyzeReport, HistoryEntry } from "../types";
import { Heatmap } from "./Heatmap";
import { DetectorCard } from "./DetectorCard";
import { Gauge } from "./Gauge";
import { fmtPct, timeAgo, VERDICT_LABEL, verdictClass, detectorName } from "../util";

export function HistoryView({ onOpen }:
{
  /** 通知父组件，比如在工作台里重跑 */
  onOpen?: (report: AnalyzeReport) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const { entries } = await fetchHistory();
      setEntries(entries);
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => { void refresh(); }, []);

  const open = async (id: string) => {
    setLoading(true);
    setErr(null);
    try {
      const rep = await fetchHistoryReport(id);
      setReport(rep);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  const close = () => setReport(null);

  // ESC 关闭
  useEffect(() => {
    if (!report) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [report]);

  return (
    <div>
      <div className="panel">
        <h3>检测历史</h3>
        <p className="hint">
          记录存在本地 <code>data/history/</code>——不上传到任何地方。
          完整报告包含每个检测器的证据，随时可审计。
        </p>
        {err && <div style={{ color: "var(--warn)", fontSize: 12.5 }}>{err}</div>}
        <table className="flat">
          <thead>
            <tr>
              <th>时间</th><th>标题</th><th>综合判定</th>
              <th>检测器</th><th>语言</th><th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  {timeAgo(e.created_at)}
                </td>
                <td style={{ maxWidth: 380, overflow: "hidden",
                             textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <a href="#" onClick={(ev) => { ev.preventDefault(); void open(e.id); }}
                     style={{ color: "var(--text)" }}>
                    {e.title || e.id}
                  </a>
                </td>
                <td>
                  <span className={`chip ${verdictClass(e.consensus_verdict)}`}>
                    {e.consensus_score.toFixed(2)} · {VERDICT_LABEL[e.consensus_verdict]}
                  </span>
                </td>
                <td className="num" style={{ fontSize: 12 }}>
                  {e.detectors_used.join(", ")}
                </td>
                <td className="num">{e.stats?.language}</td>
                <td>
                  <button className="ghost" style={{ padding: "2px 9px", fontSize: 12 }}
                    onClick={async () => {
                      await deleteHistoryReport(e.id);
                      setReport(null);
                      void refresh();
                    }}>删除</button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--text-faint)" }}>
                还没有检测记录——去「检测」页跑一次
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 报告弹窗 ─────────────────────────────────────────── */}
      {(report || loading) && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              width: "min(880px, 100%)",
              maxHeight: "88vh",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* 头部 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <b style={{ fontSize: 14 }}>
                {report ? `报告 ${report.id.slice(0, 8)}` : "加载中…"}
              </b>
              {report && (
                <span className="num" style={{ color: "var(--text-faint)" }}>
                  {report.created_at}
                </span>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {report && onOpen && (
                  <button className="ghost" style={{ padding: "4px 12px", fontSize: 12 }}
                    onClick={() => { onOpen(report); close(); }}>
                    → 在工作台中打开
                  </button>
                )}
                <button className="ghost" style={{ padding: "4px 12px", fontSize: 12 }}
                  onClick={close}>
                  ✕ 关闭
                </button>
              </div>
            </div>
            {/* 内容区：内部滚动，长文本没问题 */}
            <div style={{ overflowY: "auto", padding: 16 }}>
              {loading && !report && (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
                  <span className="spin" /> 加载报告…
                </div>
              )}
              {report && (
                <>
                  <div className="panel" style={{ marginBottom: 12 }}>
                    <div className="label">综合判定</div>
                    <div className="gauge-wrap">
                      <Gauge score={report.consensus.score}
                        verdict={report.consensus.verdict}
                        threshold={0.5} size={1} />
                      <div style={{ flex: 1 }}>
                        <div className="kv">
                          <span className="k">一致度</span>
                          <span className="v">{fmtPct(report.consensus.agreement)}</span>
                        </div>
                        {report.consensus.contributors.map((c) => (
                          <div className="kv" key={c.detector_id}>
                            <span className="k">{detectorName(c.detector_id, c.detector_id)}</span>
                            <span className="v">{c.score.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Heatmap report={report} />
                  <div className="panel" style={{ marginTop: 12 }}>
                    <div className="label">各检测器</div>
                    <div className="result-grid">
                      {report.results.map((r) => (
                        <DetectorCard key={r.detector_id} result={r} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { deleteHistoryReport, fetchHistory, fetchHistoryReport } from "../api";
import type { AnalyzeReport, HistoryEntry } from "../types";
import { Heatmap } from "./Heatmap";
import { DetectorCard } from "./DetectorCard";
import { fmtPct, timeAgo, VERDICT_LABEL, verdictClass } from "../util";

export function HistoryView({ onOpen }:
{
  /** 通知父组件，比如在工作台里重跑 */
  onOpen?: (report: AnalyzeReport) => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [report, setReport] = useState<AnalyzeReport | null>(null);
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
    try {
      const rep = await fetchHistoryReport(id);
      setReport(rep);
    } catch (e) {
      setErr(String(e));
    }
  };

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

      {report && (
        <>
          <div className="panel">
            <h3>报告 {report.id} · {report.created_at}</h3>
            {onOpen && (
              <button className="ghost" onClick={() => onOpen(report)}>
                → 在工作台中打开
              </button>
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
        </>
      )}
    </div>
  );
}

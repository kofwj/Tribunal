import { useEffect, useState } from "react";
import { timeAgo, VERDICT_LABEL, verdictClass } from "../util";

interface TimelineVersion {
  id: string;
  created_at: string;
  chars: number;
  consensus_score: number;
  consensus_verdict: string;
  detectors: Record<string, number>;
}

interface TimelineGroup {
  key: string;
  title: string;
  count: number;
  versions: TimelineVersion[];
}

const DET_COLORS: Record<string, string> = {
  hf_classifier: "#e5484d",
  stylometry: "#3e9b4f",
  llm_judge: "#8e4ec6",
  lm_perplexity: "#0090ff",
  fast_detect_gpt: "#f5a524",
  binoculars: "#12a594",
};

const DET_NAMES: Record<string, string> = {
  hf_classifier: "HF 分类器",
  stylometry: "文体指纹",
  llm_judge: "LLM 裁判",
  lm_perplexity: "困惑度",
  fast_detect_gpt: "Fast-Detect",
  binoculars: "Binoculars",
};

function Sparkline({ versions, detId }: { versions: TimelineVersion[]; detId: string | null }) {
  const W = 280, H = 64, PAD = 6;
  const vals = versions.map((v) =>
    detId ? v.detectors[detId] ?? null : v.consensus_score
  );
  const valid = vals.filter((x): x is number => x !== null);
  if (valid.length < 2) return <span className="hint">数据不足</span>;
  const min = Math.min(...valid, 0), max = Math.max(...valid, 1);
  const span = max - min || 1;
  const pts = vals.map((v, i) => {
    if (v === null) return null;
    const x = PAD + (i / (vals.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - ((v - min) / span) * (H - 2 * PAD);
    return [x, y] as const;
  });
  const segs: string[] = [];
  let cur: string[] = [];
  pts.forEach((p) => {
    if (!p) { if (cur.length > 1) segs.push(cur.join(" ")); cur = []; return; }
    cur.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
  });
  if (cur.length > 1) segs.push(cur.join(" "));
  const color = detId ? DET_COLORS[detId] ?? "#888" : "#e5484d";
  // 0.5 参考线
  const yMid = H - PAD - ((0.5 - min) / span) * (H - 2 * PAD);
  return (
    <svg width={W} height={H} className="spark">
      <line x1={PAD} x2={W - PAD} y1={yMid} y2={yMid}
            stroke="#888" strokeDasharray="3,3" strokeWidth="1" opacity="0.5" />
      {segs.map((d, i) => (
        <polyline key={i} points={d} fill="none" stroke={color}
                  strokeWidth="2" strokeLinejoin="round" />
      ))}
      {pts.map((p, i) =>
        p && <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />
      )}
    </svg>
  );
}

function GroupCard({ group }: { group: TimelineGroup }) {
  const [open, setOpen] = useState(false);
  const [det, setDet] = useState<string | null>(null);
  const vs = group.versions;
  const first = vs[0], last = vs[vs.length - 1];
  const delta = (last.consensus_score ?? 0) - (first.consensus_score ?? 0);
  const detIds = Array.from(new Set(vs.flatMap((v) => Object.keys(v.detectors))));
  // 趋势判断
  const trend = Math.abs(delta) < 0.05 ? "平稳" : delta < 0 ? "↓ 下降" : "↑ 上升";
  const trendClass = Math.abs(delta) < 0.05 ? "" : delta < 0 ? "good" : "bad";

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
           onClick={() => setOpen(!open)}>
        <div>
          <strong>{group.title}</strong>
          <span className="hint" style={{ marginLeft: 8 }}>{group.count} 个版本</span>
          <span className={`hint ${trendClass}`} style={{ marginLeft: 8 }}>{trend} {delta !== 0 && `${delta > 0 ? "+" : ""}${delta.toFixed(2)}`}</span>
        </div>
        <span className="hint">{open ? "收起 ▲" : "展开 ▼"}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <Sparkline versions={vs} detId={det} />
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <button className={det === null ? "primary" : "ghost"} onClick={() => setDet(null)}>综合</button>
            {detIds.map((id) => (
              <button key={id} className={det === id ? "primary" : "ghost"}
                      onClick={() => setDet(id)}
                      style={{ borderColor: DET_COLORS[id] }}>
                {DET_NAMES[id] ?? id}
              </button>
            ))}
          </div>
          <table className="tbl">
            <thead><tr><th>版本</th><th>时间</th><th>字数</th><th>综合分</th><th>判定</th></tr></thead>
            <tbody>
              {vs.map((v, i) => (
                <tr key={v.id}>
                  <td>v{i + 1}</td>
                  <td>{timeAgo(v.created_at)}</td>
                  <td>{v.chars}</td>
                  <td className="mono">{v.consensus_score?.toFixed(2)}</td>
                  <td><span className={verdictClass(v.consensus_verdict as any)}>
                    {VERDICT_LABEL[v.consensus_verdict] ?? v.consensus_verdict}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: 8 }}>
            自改润色通常分数平滑下降；AI 重写会有断崖式变化。结合你的实际修改过程看。
          </p>
        </div>
      )}
    </div>
  );
}

export function TimelineView() {
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/history/timeline");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        setGroups(d.groups ?? []);
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="hint">加载中…</p>;
  if (err) return <p className="err">加载失败：{err}</p>;
  if (!groups.length)
    return <p className="hint">还没有同一文档的多个版本。同一章节改完再测一次，这里就会出现版本对比曲线。</p>;

  return (
    <div>
      <p className="hint" style={{ marginBottom: 12 }}>
        按标题前 12 字自动归组。曲线看的是<strong>修改过程中 AI 分的变化趋势</strong>，不是单次分数。
      </p>
      {groups.map((g) => <GroupCard key={g.key} group={g} />)}
    </div>
  );
}

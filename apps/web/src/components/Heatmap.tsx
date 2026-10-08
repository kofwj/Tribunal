import { useMemo, useState } from "react";
import type { AnalyzeReport, DetectorResult, SegmentScore } from "../types";
import { scoreColor, isDarkUI, detectorName } from "../util";

/**
 * 原文上的句子级热力图。
 *
 * 图层：某个检测器的句子分数，或综合判定（跨检测器平均）。
 * 颜色 = 归一化分数；悬停看每个检测器在该句的值——颜色背后的"为什么"。
 */
export function Heatmap({ report }:{ report: AnalyzeReport }) {
  const [layer, setLayer] = useState<string>("consensus");
  const [hover, setHover] = useState<{ x: number; y: number; segId: string } | null>(null);

  const layers = useMemo(() => {
    const out: { id: string; name: string; scores: Map<string, number> }[] = [];
    if (report.consensus.segment_scores.length) {
      out.push({
        id: "consensus", name: "综合判定（跨检测器平均）",
        scores: new Map(
          report.consensus.segment_scores
            .filter((s) => s.score != null)
            .map((s) => [s.id, s.score as number])),
      });
    }
    for (const r of report.results) {
      if (r.segment_scores.some((s) => s.score != null)) {
        out.push({
          id: r.detector_id, name: detectorName(r.detector_id, r.name),
          scores: new Map(
            r.segment_scores
              .filter((s) => s.score != null)
              .map((s) => [s.id, s.score as number])),
        });
      }
    }
    return out;
  }, [report]);

  const active = layers.find((l) => l.id === layer) ?? layers[0];

  // tooltip 用：每个句子的各检测器分数
  const allBySeg = useMemo(() => {
    const m = new Map<string, { name: string; score: number; extras?: Record<string, unknown> }[]>();
    const push = (id: string, name: string, score: number | null, extras?: Record<string, unknown>) => {
      if (score == null) return;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push({ name, score, extras });
    };
    for (const r of report.results) {
      for (const s of r.segment_scores) push(s.id, detectorName(r.detector_id, r.name), s.score, s.extras);
    }
    for (const s of report.consensus.segment_scores) push(s.id, "综合判定", s.score);
    return m;
  }, [report]);

  if (!active) {
    return (
      <div className="panel">
        <h3>热力图</h3>
        <p className="hint">
          还没有检测器给出句子级分数。文体指纹和 LLM 类检测器会提供。
        </p>
      </div>
    );
  }

  const byPara = new Map<string, SegmentScore[]>();
  for (const seg of report.sentences) {
    const key = seg.parent_id ?? "_";
    if (!byPara.has(key)) byPara.set(key, []);
    byPara.get(key)!.push(seg);
  }

  return (
    <div className="panel">
      <h3>热力图 —— 每个句子为什么像 AI（或不像）</h3>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="heatmap-legend" style={{ margin: 0 }}>
          <span>人工</span>
          <div className="bar" />
          <span>像 AI</span>
        </div>
        <select
          value={active.id}
          onChange={(e) => setLayer(e.target.value)}
          style={{ marginLeft: "auto" }}
        >
          {layers.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <p className="hint">
        悬停看每个检测器在该句的分数 · 颜色 = 该图层的归一化 AI 概率
      </p>

      <div className="heatmap">
        {report.paragraphs.map((p) => (
          <span className="para" key={p.id}>
            {(byPara.get(p.id) ?? []).map((s) => {
              const v = active.scores.get(s.id);
              // 深色：文字本身最多提亮到 0.85；浅色：压到 0.32 保证可读
              const base = isDarkUI() ? 0.16 : 0.08;
              const bg = v != null
                ? hexAlpha(scoreColor(v), base + Math.abs(v - 0.5) * 0.5)
                : "transparent";
              return (
                <span
                  key={s.id}
                  className="seg"
                  style={{ background: bg, color: v != null ? scoreColor(v) : undefined }}
                  onMouseEnter={(e) =>
                    setHover({ x: e.clientX + 14, y: e.clientY + 14, segId: s.id })}
                  onMouseLeave={() => setHover(null)}
                >
                  {s.text}
                </span>
              );
            })}
          </span>
        ))}
      </div>

      {hover && (
        <div className="seg-tip" style={{ left: hover.x, top: hover.y }}>
          <div style={{ color: "var(--text-dim)", marginBottom: 6, fontSize: 11 }}>
            句子分数 · {hoverSegText(report, hover.segId)}
          </div>
          {(allBySeg.get(hover.segId) ?? []).map((row, i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <span style={{ color: scoreColor(row.score), minWidth: 54 }}>
                {row.score.toFixed(2)}
              </span>
              <span>{row.name}</span>
            </div>
          ))}
          {tooltipExtras(report, hover.segId)}
        </div>
      )}
    </div>
  );
}

function hoverSegText(report: AnalyzeReport, segId: string): string {
  const seg = report.sentences.find((s) => s.id === segId);
  if (!seg) return "";
  const t = seg.text.trim().replace(/\s+/g, " ");
  return t.length > 90 ? t.slice(0, 90) + "…" : t;
}

function tooltipExtras(report: AnalyzeReport, segId: string) {
  const reasons: string[] = [];
  for (const r of report.results as DetectorResult[]) {
    for (const s of r.segment_scores) {
      if (s.id === segId && s.extras) {
        const reason = s.extras["reason"];
        if (typeof reason === "string" && reason) reasons.push(`${detectorName(r.detector_id, r.name)}：${reason}`);
      }
    }
  }
  if (!reasons.length) return null;
  return (
    <div style={{ marginTop: 6, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
      {reasons.slice(0, 3).map((r, i) => (
        <div key={i} style={{ color: "var(--warn)" }}>“{r}”</div>
      ))}
    </div>
  );
}

/** #rrggbb -> rgba（按主题控制饱和度上限） */
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const cap = isDarkUI() ? 0.85 : 0.32;
  return `rgba(${r},${g},${b},${Math.max(0.06, Math.min(alpha, cap))})`;
}

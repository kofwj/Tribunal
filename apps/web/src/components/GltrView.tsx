import { useState } from "react";
import type { AnalyzeReport } from "../types";

/** GLTR 风格 token 级可视化：每个 token 按模型预测排名染色 */
function rankColor(rank: number | null): string {
  if (rank === null || rank === undefined) return "transparent";
  if (rank <= 10) return "rgba(62,155,79,0.45)";      // 绿：最可预测
  if (rank <= 100) return "rgba(245,165,36,0.45)";    // 黄
  if (rank <= 1000) return "rgba(229,72,77,0.40)";    // 红
  return "rgba(142,78,198,0.45)";                     // 紫：最不可预测
}

function cleanToken(t: string): string {
  // Qwen tokenizer: "▁" 表示空格
  return t.replace(/▁/g, " ").replace(/^Ġ/, " ");
}

export function GltrView({ report }: { report: AnalyzeReport }) {
  const [open, setOpen] = useState(false);
  const ppl = report.results.find((r) => r.detector_id === "lm_perplexity");
  const tokens = ppl?.signals?.["gltr_tokens"] as string[] | undefined;
  const ranks = ppl?.signals?.["gltr_ranks"] as (number | null)[] | undefined;

  if (!tokens || !ranks || !tokens.length) return null;

  const n = Math.min(tokens.length, ranks.length);
  let green = 0;
  for (let i = 0; i < n; i++) if (ranks[i] !== null && (ranks[i] as number) <= 10) green++;
  const greenPct = Math.round((green / n) * 100);

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
           onClick={() => setOpen(!open)}>
        <div>
          <strong>🔍 Token 可预测性（GLTR）</strong>
          <span className="hint" style={{ marginLeft: 8 }}>
            {greenPct}% 的 token 在模型预测 Top-10 内
            {greenPct > 70 ? "——AI 味重" : greenPct > 40 ? "——中等" : "——人类味重"}
          </span>
        </div>
        <span className="hint">{open ? "收起 ▲" : "展开 ▼"}</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }} className="hint">
        <span><i style={{ background: "rgba(62,155,79,0.45)", padding: "0 8px", borderRadius: 3 }}>&nbsp;</i> Top-10</span>
        <span><i style={{ background: "rgba(245,165,36,0.45)", padding: "0 8px", borderRadius: 3 }}>&nbsp;</i> Top-100</span>
        <span><i style={{ background: "rgba(229,72,77,0.40)", padding: "0 8px", borderRadius: 3 }}>&nbsp;</i> Top-1000</span>
        <span><i style={{ background: "rgba(142,78,198,0.45)", padding: "0 8px", borderRadius: 3 }}>&nbsp;</i> 1000+</span>
      </div>
      {open && (
        <div style={{
          marginTop: 10, lineHeight: 2, fontSize: 14,
          maxHeight: 320, overflowY: "auto",
          border: "1px solid var(--border)", borderRadius: 6, padding: 10,
        }}>
          {tokens.slice(0, n).map((t, i) => (
            <span key={i}
                  title={`rank: ${ranks[i] ?? "?"}`}
                  style={{
                    background: rankColor(ranks[i]),
                    borderRadius: 3, padding: "1px 2px",
                  }}>
              {cleanToken(t)}
            </span>
          ))}
          {tokens.length > n && <span className="hint">…（仅显示前 {n} 个）</span>}
        </div>
      )}
      <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
        原理：AI 生成的文本倾向于用模型觉得"最可预测"的词，一片绿=AI 味重。人类写作更跳跃，颜色更杂。
      </p>
    </div>
  );
}

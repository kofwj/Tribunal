import type { Verdict } from "./types";

/**
 * Color helpers shared by gauge + heatmap — theme-aware. Dark keeps the
 * original luminous palette (colors sit on tinted dark backgrounds);
 * light darkens the same hues for contrast on white. setDarkUI() is
 * called by App on mount and on every theme toggle.
 */
const SCALE_DARK = ["#4fb3ff", "#6ba4b8", "#7d8698", "#b8845a", "#f0644c"];
const SCALE_LIGHT = ["#1683cf", "#54798f", "#5c6c7e", "#a0620b", "#d4402b"];

let darkUI = true;
export const setDarkUI = (d: boolean) => { darkUI = d; };
export const isDarkUI = () => darkUI;

// 0 -> human blue, .5 -> neutral, 1 -> AI hot
export function scoreColor(score: number | null | undefined): string {
  const s = darkUI ? SCALE_DARK : SCALE_LIGHT;
  if (score == null) return "transparent";
  if (score <= 0.35) return s[0];
  if (score < 0.45) return s[1];
  if (score < 0.55) return s[2];
  if (score < 0.65) return s[3];
  return s[4];
}

export function verdictClass(v: Verdict | null | undefined): string {
  switch (v) {
    case "likely_ai": return "ai";
    case "likely_human": return "human";
    default: return "uncertain";
  }
}

export const VERDICT_LABEL: Record<string, string> = {
  likely_ai: "疑似 AI",
  likely_human: "疑似人工",
  uncertain: "存疑",
};

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toFixed(digits);
}

export function familyLabel(f: string): string {
  switch (f) {
    case "stylometry": return "文体统计";
    case "local_lm": return "本地模型";
    case "classifier": return "分类器";
    case "byok_llm": return "自带 LLM";
    case "plugin": return "插件";
    case "meta": return "综合";
    default: return f;
  }
}

/** 检测器中英文名称与简介映射 */
export const DETECTOR_ZH: Record<string, { name: string; desc: string }> = {
  stylometry: {
    name: "文体指纹",
    desc: "统计语言学指纹：突发性、重复模式、连接词套话、中英 AI 痕迹词。零依赖。",
  },
  lm_perplexity: {
    name: "困惑度检测",
    desc: "本地小模型下的平均困惑度。中文请指向多语言模型。",
  },
  fast_detect_gpt: {
    name: "Fast-DetectGPT",
    desc: "条件概率曲率：机器文本在扰动下更能守住概率峰值。",
  },
  binoculars: {
    name: "Binoculars",
    desc: "双模型交叉验证：执行者与观察者模型的一致性对比。",
  },
  hf_classifier: {
    name: "HF 分类器",
    desc: "任意 HuggingFace 文本分类模型，一键换模型。",
  },
  llm_judge: {
    name: "LLM 裁判",
    desc: "用你自己的大模型当裁判：结构化判决 + 段落级标记 + 理由说明。",
  },
};

export function detectorName(id: string, fallback: string): string {
  return DETECTOR_ZH[id]?.name ?? fallback;
}

export function detectorDesc(id: string, fallback: string): string {
  return DETECTOR_ZH[id]?.desc ?? fallback;
}

export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.round(s / 60)} 分钟前`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} 小时前`;
  return `${Math.round(s / 86400)} 天前`;
}

/**
 * 原理页 —— 把 docs/ 的快照直接做到工作台里，
 * 因为看不懂的检测器，不值得信任。
 */
export function DocsView() {
  return (
    <div>
      <div className="panel">
        <h3>为什么是工作台，而不是单个"AI 检测仪"</h3>
        <p>
          单一分数的 AI 检测器注定失败，因为它们把证据藏起来了。
          AITextJury 的核心是<b>检测器 API</b>：每种方法——
          文体统计、本地模型困惑度、Fast-DetectGPT 式曲率、
          Binoculars 式跨模型验证、HF 分类器、你自己的 LLM 裁判、社区插件——
          返回的都是同一种结构：
        </p>
        <pre style={{ background: "var(--bg)", padding: 12, borderRadius: 8, fontSize: 12.5 }}>{`{
  score:        0.62,          // 归一化的 AI 概率
  raw_score:    14.2,          // 检测器的原生统计量
  raw_direction:"lower_is_ai", // 原始分怎么读
  verdict:      "uncertain",   // 按阈值判，接近阈值就是存疑
  confidence:   0.58,
  threshold:    0.71,          // 来自校准或默认区间
  signals:      { ... },       // 如困惑度、突发性、crossH
  segment_scores:[ ... ],      // 逐句分数 → 热力图
  evidence:     [ ... ],       // 人能看懂的理由
  calibration:  { status, auc, ece, brier, n, ... }
}`}</pre>
        <p style={{ marginTop: 10 }}>
          综合判定是个元检测器，不是你必须服从的多数投票：
          按校准质量加权，分歧本身就是一等信号。
        </p>
      </div>

      <div className="panel">
        <h3>检测器一览</h3>
        <table className="flat">
          <thead><tr><th>方法</th><th>类型</th><th>核心思想</th></tr></thead>
          <tbody>
            <tr><td><b>文体指纹</b></td><td>本地统计</td>
              <td>突发性、重复模式、连接词套话、中英 AI 痕迹词。零依赖。</td></tr>
            <tr><td><b>困惑度检测</b></td><td>本地模型</td>
              <td>小模型下的平均困惑度（默认 gpt2；中文请换多语言模型）。</td></tr>
            <tr><td><b>Fast-DetectGPT</b></td><td>本地模型</td>
              <td>条件概率曲率：机器文本在 token 扰动下更能守住概率峰值
                  （<a href="https://arxiv.org/abs/2310.05130" target="_blank" rel="noreferrer">Bao 等，ICLR'24 ↗</a>）。
                  这是文档化的变体——看卡片内说明。</td></tr>
            <tr><td><b>Binoculars</b></td><td>本地双模型</td>
              <td>执行者与观察者模型的交叉验证
                  （<a href="https://arxiv.org/abs/2401.12070" target="_blank" rel="noreferrer">Hans 等 2024 ↗</a>）。
                  精神忠实于原文；原阈值不迁移——请本地校准。</td></tr>
            <tr><td><b>HF 分类器</b></td><td>自带模型</td>
              <td>任意 HuggingFace 文本分类模型（如 HC3 系检测器）。
                  跨领域迁移差——一定要实测。</td></tr>
            <tr><td><b>LLM 裁判</b></td><td>自带 Key</td>
              <td>你的 OpenAI/Gemini/DeepSeek/OpenRouter/Ollama/… 模型
                  按严格 JSON 协议判决：标段落、给理由。</td></tr>
            <tr><td><b>插件</b></td><td>社区</td>
              <td>任何带 <code>register(registry)</code> 的 Python 文件——
                  看自带的 <code>length_rhythm</code> 示例（30 行）
                  和 <code>docs/DETECTOR_API.md</code>。</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>校准与诚实度</h3>
        <p>
          每个分数都带着<b>校准状态</b>。开箱即用的是文档化的默认阈值，
          会标 <span className="chip warn">未校准</span>。
          放一份标注语料（<code>data/bench/*.jsonl</code>：每行
          <code>{`{"text":…, "label":0|1}`}</code>），
          点<b>重校准</b>：后端拟合 logistic 映射、选最大准确率阈值、
          算 AUC / ECE / Brier。综合判定时按实测准确率给权重。
        </p>
      </div>

      <div className="panel">
        <h3>它不是什么</h3>
        <ul style={{ color: "var(--text-dim)", lineHeight: 1.8, margin: 0 }}>
          <li><b>不是查重工具</b>——它找不到来源。</li>
          <li><b>不是审判机器</b>——分数是给人决策的证据。
              对抗改写过的文本能骗过大多数已知检测器，诚实的工具会明说。</li>
          <li><b>不是科学基准</b>——自带 demo 集只是演示。
              请用<i>你自己领域</i>的数据校准（网文？论文？营销文案？）。</li>
          <li><b>不是窥探者</b>——历史、密钥、拟合结果都在本地文件；
              自带 Key 的调用只发往你配置的服务商。</li>
        </ul>
      </div>

      <div className="panel">
        <h3>抗改写实测（2026-10-09）</h3>
        <p style={{ color: "var(--text-dim)", lineHeight: 1.8 }}>
          用 Humanizer-zh 规则改写一段高 AI 味网文，测各检测器分数变化：
        </p>
        <table className="flat">
          <thead><tr><th>检测器</th><th>改写前</th><th>改写后</th><th>结论</th></tr></thead>
          <tbody>
            <tr><td><b>HF 分类器</b></td><td>0.997</td><td>0.465</td>
              <td style={{ color: "var(--danger)" }}>易被绕过——换说法、去套话就能腰斩</td></tr>
            <tr><td><b>文体指纹</b></td><td>0.596</td><td>0.603</td>
              <td style={{ color: "var(--success)" }}>抗改写强——看深层习惯，表面改写洗不掉</td></tr>
            <tr><td><b>综合</b></td><td>0.796</td><td>0.534</td>
              <td>likely_ai → uncertain</td></tr>
          </tbody>
        </table>
        <ul style={{ color: "var(--text-dim)", lineHeight: 1.8, marginTop: 10 }}>
          <li>不要只看一个检测器：HF 分数高不代表实锤，看文体指纹是否也高。</li>
          <li>改写只能洗掉表面分：如果文体指纹也判高，得从句式节奏上重写，换词没用。</li>
          <li>短文本（80 词以下）任何检测器的结论都要打折。</li>
        </ul>
      </div>
    </div>
  );
}

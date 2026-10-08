# AITextJury 中文版

**一个 AI 文本检测器的陪审团，你来当法官。**

AITextJury 是一个开放的 AI 生成文本检测工作台——不是那种只吐一个不靠谱百分比的"又一个 AI 检测器"。粘贴文本，同时跑**多种**独立的检测方法，看底层的证据——逐句热力图、困惑度、跨模型一致性、文体指纹、校准质量——再下判断。每个检测器都是一位陪审员，负责呈堂证供； verdict 由你来定。可以把它理解成 AI 文本检测界的 VirusTotal：任何人都能写检测器插件接进来，公开对比各种方法。

本仓库是基于 [YiCQi/AITextJury](https://github.com/YiCQi/AITextJury) 的中文定制分支：全站中文化、针对中文网文优化、修复上游 bug。

```
┌─────────────────────────────────────────────────────────────────┐
│                     AITextJury 工作台                            │
│  文本 ─▶ 分句 ─▶ 检测器（并行，有缓存） ─▶ 综合判定               │
└───────────┬──────────────────────────────────────────────────────┘
            │
   ┌────────┴────────────────────────────────────────────┐
   │ 检测器 API（所有检测器返回统一格式）                  │
   └────────┬────────────────────────────────────────────┘
        ┌────┴─────┬─────────────┬────────────┬─────────────┐
   文体指纹      本地语言模型    分类器       LLM 裁判      你的
   （统计）    困惑度 /        （自选 HF    （自带 Key：   插件
              快速检测 /       模型）       OpenAI、     (plugins/)
              双筒望远镜                   Gemini、
                                          DeepSeek、
                                          Ollama…）
```

## 快速开始

需要 [Python 3.10+](https://www.python.org/downloads/) 和 Node 18+。

```bash
git clone https://github.com/kofwj/aitextjury-zh.git
cd aitextjury-zh

# Docker（不需要装 Python/Node，自带 torch）：
docker compose up
# 打开 http://localhost:8000

# 本地开发：
# Windows (PowerShell)
scripts\setup.ps1 -Ml     # 一次性：建虚拟环境 + 装依赖（含 torch）
scripts\dev.ps1           # 工作台 http://localhost:5173，API :8000

# Linux / macOS
./scripts/setup.sh --with-ml
./scripts/dev.sh
```

* **为什么加 `--with-ml`**：不加就是轻量安装（没有 torch），四个基于语言模型的检测器会显示`不可用`，面板上会告诉你修复命令。加 flag 重跑是安全的（复用虚拟环境）。GPT-2 系列权重（约 0.5–2 GB）首次分析时自动下载；如果 HuggingFace 被墙，先设 `HF_ENDPOINT=https://hf-mirror.com`。之后全离线运行。
* 报 `ModuleNotFoundError: fastapi`？说明你没进虚拟环境——用 dev 脚本，或先激活 `apps/api/.venv`。

## 怎么用

在**检测**页粘贴文本，勾选检测器，点**开始检测**，从上往下看：

1. **综合判定**——各检测器按校准质量加权的投票。检测器意见不一致时，备注会写明谁说了什么；分歧是信息，不是 bug。
2. **检测器卡片**——每个 `score` 都已归一化，**越高越像 AI**。原始值保留原生方向，每张卡片都会注明（比如*双筒望远镜：原始值 6.4，越低越像 AI*）。
3. **热力图**——文本的**哪些部分**像 AI，精确到句/段。
4. **证据条**—— verdict 背后的硬数字：困惑度、突发性、套话命中……

其他页签：

* **模型接入**——粘贴任意 OpenAI 兼容或 Gemini 的 key（DeepSeek、OpenRouter、本地 Ollama，甚至免 key）来启用 **LLM 裁判**。Key 只存在本地 `data/providers.json`，页面上打码显示。
* **校准**——把标注样本丢进 `data/bench/*.jsonl`（`{"text": ..., "label": 1}` 表 AI / `0` 表人工），点**重新校准**：每个检测器给出真实的 AUC / 准确率，综合判定的权重按实测质量来。
* **原理**——每个检测器测什么、对什么盲区。

还有个命令行，同一个引擎：

```bash
python -m aitextjury.cli analyze article.txt -d stylometry -o report.json
python -m aitextjury.cli calibrate -d stylometry --dataset demo
```

> 隐私：除了 LLM 裁判，**全在本机跑**——文本、历史、key 不出内网。裁判指向本地 Ollama/vLLM 就是纯离线。

## 检测器一览

| 检测器 | 类型 | 需要 | 原理 |
|---|---|---|---|
| **文体指纹** | 本地统计 | 无 | 突发性、重复模式、连接词套话、LLM 腔"马脚"（中英双语词表） |
| **困惑度检测** | 本地语言模型 | torch+transformers | 小因果语言模型下的平均 token 困惑度（默认 gpt2，可换） |
| **快速检测** | 本地语言模型 | torch+transformers | 条件概率曲率，对比扰动法（[Bao et al., ICLR'24](https://arxiv.org/abs/2310.05130)） |
| **双筒望远镜** | 本地双模型 | torch+transformers | 执行者/观察者跨模型一致性（[Hans et al. 2024](https://arxiv.org/abs/2401.12070)） |
| **HF 分类器** | 自选模型 | torch+transformers | 任意 HuggingFace 文本分类模型，中文推荐 `yuchuantian/AIGC_detector_zhv3` |
| **LLM 裁判** | 自带 Key | provider key 或本地 Ollama | 让你的 LLM 用严格 JSON 协议当裁判，标段落、给理由 |
| **插件** | 社区 | 任意 | 比如自带的 `length_rhythm` 示例（30 行） |

每个结果都展示：归一化分数、原始统计量（+方向）、判定、阈值、信号、证据，以及**校准状态**——或一条诚实的报错。

## 自带 Key（BYOK）

OpenAI、Gemini、DeepSeek、OpenRouter、Groq、免 key 的本地 Ollama，或任何 OpenAI 兼容接口（vLLM、LM Studio…）。Key 只存本地 `data/providers.json`，只发往你配置的接口，页面上永远打码，为空时回退到环境变量（`OPENAI_API_KEY`、`GEMINI_API_KEY`…）。详见 [docs/BYOK.md](docs/BYOK.md)。

## 校准——诚实引擎

开箱即用的是文档化的**默认阈值**，会明确标 `未校准`。用标注数据拟合后（页面按钮或 `POST /api/calibration/run`），每个检测器报告 **AUC / 准确率 / ECE / Brier**，综合判定按实测准确率加权。自带的 demo 集只是 demo——请用你自己领域的数据校准。

## 插件——人人可加检测器

```python
# data/plugins/my_detector.py（或 plugins/ 放自带示例）
from aitextjury.detectors.base import BaseDetector, RawOutcome
from aitextjury.schemas import Availability

class MyDetector(BaseDetector):
    id, name, family, description, DEFAULT_BANDS = ...  # 见 docs/DETECTOR_API.md

    def availability(self, ctx=None):
        return Availability(ok=True)

    async def analyze(self, ctx):
        ...  # ctx.text, ctx.segmentation, ctx.providers…
        return RawOutcome(raw_score=..., raw_direction="higher_is_ai",
                          signals={...}, segment_scores=[...],
                          evidence=[EvidenceItem(title=…, detail=…)])

def register(registry):
    registry.register(MyDetector())
```

重启 API——你的检测器出现在 UI 里，校准、缓存、综合判定一视同仁。完整契约见 [docs/DETECTOR_API.md](docs/DETECTOR_API.md)。

## 目录结构

```
apps/api/aitextjury/     FastAPI 后端：检测器注册表、引擎、校准、
                         BYOK 接入、CLI、评测集
apps/web/                React + Vite + TypeScript 工作台 UI
plugins/                 自带示例插件
data/                    运行时状态（历史、key、缓存、拟合）——仅本地
docs/                    架构、检测器 API、BYOK、路线图
tests 在 apps/api/tests
```

## 诚实的局限

* **对抗文本能骗过检测器。** 改写、洗稿、人工润色过的 AI 文，和精修过的人类文本，确实有重叠区。AITextJury 只呈现证据、让人来判——绝不能当实锤，更不能用来指控学生/作者。
* 本地语言模型检测器默认是小而偏英文的模型（`gpt2`）；中文请在检测器设置里换多语言模型（如 `Qwen2.5-0.5B`）。
* 分数是不是概率，校准说了算（所以校准状态到处都显示）。

## 本分支的改动

见 [CHANGELOG-zh.md](CHANGELOG-zh.md)。主要包括：

* 前端全站中文化 + 视觉重做
* 检测器选择面板重设计（紧凑布局、全选/清空、状态圆点）
* 修复上游 `availability(ctx=None)` 导致已配置检测器显示不可用的 bug（检测器列表、校准接口、校准上下文三处）
* HF 分类器批量推理 + 进程内模型缓存（177 句从 89 秒降到热机后 0.7 秒/6 句）
* Dockerfile 默认 CPU 版 torch，支持 `HF_ENDPOINT` 镜像源
* 中文检测推荐模型：`yuchuantian/AIGC_detector_zhv3`（ICLR'24 MPU 方法）

## 相关开源项目

* [baoguangsheng/fast-detect-gpt](https://github.com/baoguangsheng/fast-detect-gpt) (434★) —— Fast-DetectGPT 论文（ICLR'24），我们实现的参考。同样 [ahans30/Binoculars](https://github.com/ahans30/Binoculars) (421★, ICML'24)。
* [Hello-SimpleAI](https://huggingface.co/Hello-SimpleAI) `chatgpt-detector-roberta` / `-long` —— HF 分类器的即插即用模型。
* [YuchuanTian/AIGC_text_detector](https://github.com/YuchuanTian/AIGC_text_detector) (472★) —— MPU 多尺度检测（ICLR'24 spotlight），中文 v3 模型。
* [lynote-ai/ai-text-detector](https://github.com/lynote-ai/ai-text-detector) (445★) —— 本地、谨慎、可解释，理念相近。

## License

MIT —— 见 [LICENSE](LICENSE)。检测方法归原作者和论文所有，检测器卡片和文档里有链接。

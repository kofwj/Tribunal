<h1 align="center">三堂会审 Tribunal</h1>

<p align="center">
  <strong>一个 AI 文本检测器的陪审团，你来当法官。</strong>
</p>

<p align="center">
  粘贴文本，多种独立检测方法并排跑，<br />
  看完证据再下判断。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-1f6feb?style=for-the-badge" alt="MIT license" />
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/kofwj/Tribunal?style=flat-square&color=ffd33d&logo=github" alt="Stars" />
  <img src="https://img.shields.io/github/forks/kofwj/Tribunal?style=flat-square&color=8957e5&logo=github" alt="Forks" />
  <img src="https://img.shields.io/github/last-commit/kofwj/Tribunal?style=flat-square&color=3fb950&logo=github" alt="Last commit" />
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>简体中文</strong>
</p>

---

> [!NOTE]
> 本仓库是 [YiCQi/AITextJury](https://github.com/YiCQi/AITextJury) 的中文定制分支。
> 改动清单见 [CHANGELOG-zh.md](CHANGELOG-zh.md)。

## 这是什么

不是那种只吐一个不靠谱百分比的"又一个 AI 检测器"。可以把它理解成 AI 文本检测界的 VirusTotal：任何人都能写检测器插件接进来，公开对比各种方法。

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

```bash
git clone https://github.com/kofwj/Tribunal.git
cd aitextjury-zh
docker compose up
# → http://localhost:8000
```

<details>
<summary>本地开发（不用 Docker）</summary>

需要 [Python 3.10+](https://www.python.org/downloads/) 和 Node 18+。

```bash
# Windows (PowerShell)
scripts\setup.ps1 -Ml     # 一次性：建虚拟环境 + 装依赖（含 torch）
scripts\dev.ps1           # 工作台 http://localhost:5173，API :8000

# Linux / macOS
./scripts/setup.sh --with-ml
./scripts/dev.sh
```

* **为什么加 `--with-ml`**：不加就是轻量安装（没有 torch），四个基于语言模型的检测器会显示`不可用`。
* HuggingFace 被墙的话，先设 `HF_ENDPOINT=https://hf-mirror.com`。之后全离线运行。
</details>

## 怎么用

在**检测**页粘贴文本，勾选检测器，点**开始检测**，从上往下看：

1. **综合判定**——各检测器按校准质量加权的投票。意见不一致时备注会写明谁说了什么；分歧是信息，不是 bug。
2. **检测器卡片**——每个分数都已归一化，**越高越像 AI**。原始值保留原生方向，每张卡片都会注明。
3. **热力图**——文本的**哪些部分**像 AI，精确到句/段。
4. **证据条**—— verdict 背后的硬数字：困惑度、突发性、套话命中……

其他页签：

* **模型接入**——粘贴任意 OpenAI 兼容或 Gemini 的 key 来启用 **LLM 裁判**。Key 只存本地 `data/providers.json`，页面打码。
* **校准**——把标注样本丢进 `data/bench/*.jsonl`（`{"text": ..., "label": 1}` 表 AI / `0` 表人工），点**重新校准**：每个检测器给出真实的 AUC / 准确率，综合判定按实测质量加权。
* **原理**——每个检测器测什么、对什么盲区。

> 隐私：除了 LLM 裁判，**全在本机跑**——文本、历史、key 不出内网。裁判指向本地 Ollama/vLLM 就是纯离线。

## 检测器一览

| 检测器 | 类型 | 需要 | 原理 |
|---|---|---|---|
| **文体指纹** | 本地统计 | 无 | 突发性、重复模式、连接词套话、LLM 腔"马脚"（中英双语） |
| **困惑度检测** | 本地语言模型 | torch+transformers | 小因果语言模型下的平均 token 困惑度 |
| **快速检测** | 本地语言模型 | torch+transformers | 条件概率曲率（[Bao et al., ICLR'24](https://arxiv.org/abs/2310.05130)） |
| **双筒望远镜** | 本地双模型 | torch+transformers | 跨模型一致性（[Hans et al. 2024](https://arxiv.org/abs/2401.12070)） |
| **HF 分类器** | 自选模型 | torch+transformers | 任意 HuggingFace 文本分类模型，中文推荐 `yuchuantian/AIGC_detector_zhv3` |
| **LLM 裁判** | 自带 Key | provider key 或本地 Ollama | 让你的 LLM 用严格 JSON 协议当裁判 |
| **插件** | 社区 | 任意 | 如自带的 `length_rhythm` 示例 |

## 诚实的局限

* **对抗文本能骗过检测器。** 改写、洗稿、人工润色过的 AI 文，和精修过的人类文本确实有重叠。只呈现证据、让人来判——绝不能当实锤，更不能用来指控学生/作者。
* 本地模型默认偏英文（`gpt2`）；中文请在检测器设置里换多语言模型。
* 分数是不是概率，校准说了算（所以校准状态到处都显示）。

## 本分支的改动

详见 [CHANGELOG-zh.md](CHANGELOG-zh.md)。要点：

* 前端全站中文化 + 视觉重做
* 检测器选择面板重设计（紧凑布局、全选/清空、状态圆点）
* 历史记录点开后自动滚动到报告位置
* 修复上游 `availability(ctx=None)` bug（检测器列表、校准接口、校准上下文三处）
* HF 分类器批量推理 + 进程内缓存（177 句从 89 秒降到热机后 0.7 秒/6 句）
* Dockerfile 默认 CPU 版 torch，支持 `HF_ENDPOINT` 镜像源
* 中文推荐模型：`yuchuantian/AIGC_detector_zhv3`（ICLR'24 MPU 方法）

## 相关项目

* [baoguangsheng/fast-detect-gpt](https://github.com/baoguangsheng/fast-detect-gpt) (434★) · [ahans30/Binoculars](https://github.com/ahans30/Binoculars) (421★)
* [YuchuanTian/AIGC_text_detector](https://github.com/YuchuanTian/AIGC_text_detector) (472★) —— MPU 多尺度检测（ICLR'24 spotlight），中文 v3 模型
* [lynote-ai/ai-text-detector](https://github.com/lynote-ai/ai-text-detector) (445★) —— 本地、谨慎、可解释

## License

MIT —— 见 [LICENSE](LICENSE)。检测方法归原作者和论文所有。

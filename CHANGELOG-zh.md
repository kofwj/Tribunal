# 中文定制版变更记录

基于 [YiCQi/AITextJury](https://github.com/YiCQi/AITextJury) 的中文定制分支。

## 2026-10-08

### 前端全站中文化 + 视觉重做
- 全部界面文案译为简体中文（页签：检测 / 历史 / 校准 / 模型接入 / 原理）
- 检测器中文名与描述（文体指纹 / 困惑度检测 / 快速检测 / 双筒望远镜 / HF 分类器 / LLM 裁判）
- 补齐上游缺失的 CSS 类（检测器卡片、证据条、结果网格、加载动画等）
- 检测器选择面板重设计：双列紧凑布局、全选/清空、已选计数、状态圆点（绿=已校准/黄=未校准/灰=不可用）

### 后端修复
- **engine.py**：修复检测器可用性判断 bug —— `/api/detectors` 调用 `availability(ctx=None)` 导致已配置模型的检测器显示为不可用（UI 复选框被灰掉）。增加 `_SettingsProbe` 使检测器列表能读取真实配置。
- **hf_classifier.py**：性能优化 —— 原实现逐句调用 HuggingFace pipeline（177 句需 89 秒），改为 batch=32 批量推理 + 进程内模型缓存。热机后 6 句约 0.7 秒。
- **Dockerfile**：默认使用 CPU 版 torch（原 CUDA 版镜像 2.5GB+），支持 `HF_ENDPOINT` 镜像源。

### 部署
- `docker-compose.yml`：宿主机源码只读挂载，改后端代码后重启容器即生效，无需重建镜像。
- 前端构建产物（`apps/api/aitextjury/static/`）改为构建时生成，不再提交到仓库。

### 中文检测
- HF 分类器默认模型建议使用 `yuchuantian/AIGC_detector_zhv3`（ICLR 2024 MPU 方法中文 v3，面向 DeepSeek/GPT-4 等新模型），自建 50 条中文标注集上显著优于原默认模型。
- 注意：第三方检测分数仅为概率信号，不能作为平台判定的依据。

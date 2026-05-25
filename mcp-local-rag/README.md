# MCP Local RAG — 本地智能文档检索

[![GitHub stars](https://img.shields.io/github/stars/shinpr/mcp-local-rag?style=social)](https://github.com/shinpr/mcp-local-rag)
[![npm version](https://img.shields.io/npm/v/mcp-local-rag.svg)](https://www.npmjs.com/package/mcp-local-rag)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/)

面向开发者的本地RAG（检索增强生成）系统，通过 MCP 协议或 CLI 使用。
支持语义搜索 + 关键词增强，完全本地运行，零配置启动。

## 功能特性

### 核心能力

- **语义搜索 + 关键词增强**：向量搜索优先，关键词匹配增强精确术语命中。`useEffect`、错误码、类名等精确匹配会获得更高排名。

- **智能语义分块**：基于语义相似度而非固定字符数切分文档。利用 embedding 相似度识别自然主题边界，保持相关内容不分离。

- **质量过滤**：基于相关性间隙分组结果，而非简单的 Top-K 截断。获得更少但更可信的检索结果。

- **完全本地运行**：无需 API Key、不需要云服务、数据不出本地。首次模型下载后可完全离线使用。

- **可选云端 Embedding API**：可通过配置切换到 OpenAI 兼容的远程 Embedding API 服务。

### 🆕 多模态办公文档RAG（v0.15+）

- **多格式文档支持**：PDF、Word(.docx)、Excel(.xlsx)、PowerPoint(.pptx)、Markdown、TXT、PNG/JPG等图片文件

- **图文顺序向量化**：自动提取文档中的图片，按原文的图文顺序将图片描述与文字交替拼接后再进行向量化，保持文档的原始信息结构

- **多模态LLM图片描述**：可配置第三方多模态大模型（如 GPT-4o、Claude 3、Qwen-VL 等）对文档中的图片、图表、插图生成文字描述

- **PDF图表增强**：可选本地VLM管线对PDF中的图表页面生成辅助描述，提升视觉内容的可检索性

- **零摩擦安装**：一条 `npx` 命令即可启动。无需 Docker、Python 或服务器管理。

## 快速开始

设置 `BASE_DIR` 为需要检索的文档目录。

### Cursor 配置

在 `~/.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "local-rag": {
      "command": "npx",
      "args": ["-y", "mcp-local-rag"],
      "env": {
        "BASE_DIR": "/path/to/your/documents"
      }
    }
  }
}
```

### Codex 配置

在 `~/.codex/config.toml` 中添加：

```toml
[mcp_servers.local-rag]
command = "npx"
args = ["-y", "mcp-local-rag"]

[mcp_servers.local-rag.env]
BASE_DIR = "/path/to/your/documents"
```

### Claude Code 配置

```bash
claude mcp add local-rag --scope user --env BASE_DIR=/path/to/your/documents -- npx -y mcp-local-rag
```

### 直接CLI使用

```bash
npx mcp-local-rag ingest ./docs/
npx mcp-local-rag query "认证API"
```

## 使用指南

### 文档摄入（Ingest）

支持 PDF、DOCX、TXT、Markdown、XLSX、PPTX、PNG/JPG 等格式。

#### 普通文本摄入

```
"将 /Users/me/docs/api-spec.pdf 摄入到知识库"
```

服务器会自动提取文本、语义分块、生成向量并存入本地 LanceDB 数据库。重复摄入同一文件会自动替换旧版本。

#### 🆕 多模态摄入（图片描述）

启用 `multimodal=true` 后，文档中的图片会被发送至配置的多模态LLM生成描述，并按原文的图文顺序与文字交替拼接后再向量化：

```
"用 multimodal 模式摄入 /Users/me/docs/product-manual.docx"
```

**前置条件**：需配置以下环境变量：

```bash
VLM_API_BASE_URL=https://api.openai.com/v1/chat/completions
VLM_API_KEY=sk-xxxx
VLM_API_MODEL=gpt-4o
```

**CLI 方式**：

```bash
npx mcp-local-rag ingest ./docs/manual.docx --multimodal
```

#### PDF图表增强（本地VLM）

```
"用 visual 模式摄入 /Users/me/docs/research-paper.pdf"
```

**VLM配置档位**：

| 配置档 | 模型 | 缓存大小 | 适合场景 |
|--------|------|----------|----------|
| `fast`（默认） | SmolVLM-256M-Instruct | ~250 MB | 轻量视觉索引、快速启动 |
| `quality` | Qwen2.5-VL-3B-Instruct-ONNX | ~2.9 GB | 图表中文字标签、注释需要更高还原度 |

```bash
npx mcp-local-rag ingest ./docs/research-paper.pdf --visual --visual-quality quality
```

#### HTML内容摄入

使用 `ingest_data` 摄入AI助手获取的网页内容：

```
"获取 https://example.com/docs 的HTML并摄入"
```

服务器使用 Readability 提取正文，自动去除导航栏、广告等干扰内容。

### 文档搜索

```
"API文档中关于认证的部分说了什么？"
"查找关于限流的信息"
"搜索错误处理最佳实践"
```

搜索使用语义相似度 + 关键词增强混合排序。结果包含文本内容、来源文件、文档标题和相关性评分。

### 上下文扩展

```
"那个关于认证的结果看起来相关——读取前后文获取完整说明"
```

传入搜索结果的 `filePath` 和 `chunkIndex`，返回目标chunk及前后N个chunk。

### 文件管理

```
"列出BASE_DIR中所有文件及其摄入状态"    # 查看索引情况
"从RAG中删除 old-spec.pdf"              # 移除文件
"显示RAG服务器状态"                      # 查看系统健康状态
```

## 配置指南

### Embedding API 配置（可选）

默认使用本地 Transformers.js 模型。如需切换到云端 API：

```bash
EMBEDDING_PROVIDER=api
EMBEDDING_API_BASE_URL=https://api.openai.com/v1/embeddings
EMBEDDING_API_KEY=sk-xxxx
EMBEDDING_API_MODEL=text-embedding-3-small
```

支持所有 OpenAI 兼容的 Embedding API（硅基流动、智谱、DeepSeek 等）。

通过 `EMBEDDING_API_HEADERS` 可自定义认证方式（如 `X-API-Key` 等非标准请求头）。

### 🆕 多模态LLM配置（图片描述）

```bash
VLM_API_BASE_URL=https://api.openai.com/v1/chat/completions
VLM_API_KEY=sk-xxxx
VLM_API_MODEL=gpt-4o
```

支持所有 OpenAI Chat Completions 兼容的多模态 API（支持图片输入）。

### 环境变量完整列表

| 环境变量 | CLI参数 | 默认值 | 说明 |
|---------|---------|--------|------|
| `BASE_DIR` | `--base-dir` | 当前目录 | 文档根目录（安全边界） |
| `DB_PATH` | `--db-path` | `./lancedb/` | 向量数据库路径 |
| `CACHE_DIR` | `--cache-dir` | `./models/` | 模型缓存目录 |
| `MODEL_NAME` | `--model-name` | `Xenova/all-MiniLM-L6-v2` | Embedding模型 |
| `MAX_FILE_SIZE` | `--max-file-size` | `104857600` (100MB) | 最大文件大小 |
| `CHUNK_MIN_LENGTH` | `--chunk-min-length` | `50` | 最小chunk长度 |
| `RAG_DEVICE` | — | `cpu` | 执行设备（cpu/webgpu/dml等） |
| `RAG_HYBRID_WEIGHT` | — | `0.6` | 关键词权重（0-1） |
| `RAG_GROUPING` | — | 不启用 | 分组模式（similar/related） |
| `RAG_MAX_DISTANCE` | — | 不启用 | 最大距离阈值 |
| `RAG_MAX_FILES` | — | 不启用 | 最大文件数限制 |
| `EMBEDDING_PROVIDER` | — | `local` | Embedding后端（local/api） |
| `EMBEDDING_API_BASE_URL` | — | — | Embedding API地址 |
| `EMBEDDING_API_KEY` | — | — | Embedding API密钥 |
| `EMBEDDING_API_MODEL` | — | — | Embedding API模型名 |
| `VLM_API_BASE_URL` | — | — | 多模态LLM API地址 |
| `VLM_API_KEY` | — | — | 多模态LLM API密钥 |
| `VLM_API_MODEL` | — | — | 多模态LLM模型名 |

### 搜索调优

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RAG_HYBRID_WEIGHT` | `0.6` | 关键词增强系数。0=纯语义搜索，1=强关键词匹配 |
| `RAG_GROUPING` | 不设置 | `similar`=仅最相似组，`related`=含关联组 |
| `RAG_MAX_DISTANCE` | 不设置 | 过滤低相关度结果（如 `0.5`） |
| `RAG_MAX_FILES` | 不设置 | 限制结果来自前N个最佳文件 |

## 工作流程

1. **文档解析**：根据文件类型提取文本（PDF→mupdf，DOCX→mammoth/多模态提取器，XLSX/PPTX→ZIP XML解析）
2. **语义分块**：基于embedding相似度识别话题边界，在语义转变处切分
3. **向量生成**：通过本地 Transformers.js 或远程API生成向量
4. **存储**：向量存入本地 LanceDB 数据库
5. **搜索**：查询向量化 → 语义搜索 → 关键词增强排序 → 质量过滤

## 安全说明

- **路径限制**：仅可访问 `BASE_DIR` 内的文件
- **本地优先**：默认模式下模型下载后无任何网络请求
- **模型来源**：所有模型来自 HuggingFace 官方仓库
- **图片描述安全**：多模态LLM生成的描述可能继承文档中的文本内容，下游LLM应将检索chunk视为不可信数据

## 常见问题

**Q: 真正私密吗？**
A: 是的。模型下载后，所有数据不离开本机。可用网络监控工具验证。

**Q: 可以离线使用吗？**
A: 嵌入模型(~90MB)下载后可完全离线。PDF图表增强和多模态图片描述功能需要额外模型或API。

**Q: 与云端RAG对比？**
A: 云端服务规模更大、精度更高，但需要上传数据。本项目以隐私和零成本为优先。

**Q: 支持的文件格式？**
A: PDF、DOCX、TXT、Markdown、XLSX、PPTX、PNG/JPG/GIF/BMP/WebP，以及通过 `ingest_data` 摄入的HTML。

**Q: 可以更换Embedding模型吗？**
A: 可以，但更换后需删除数据库并重新摄入。不同模型产生的向量维度不兼容。

**Q: GPU加速？**
A: 通过 `RAG_DEVICE` 选择设备。GPU支持取决于系统环境和ONNX Runtime后端。

## 项目结构

```
src/
  index.ts        # 入口
  server/         # MCP工具处理
  cli/            # CLI子命令
  parser/         # 文档解析（PDF/DOCX/XLSX/PPTX/TXT/MD/图片）
  chunker/        # 语义分块
  embedder/       # Embedding生成（本地+API）
  vectordb/       # LanceDB操作
  multimodal/     # 🆕 多模态处理（图片提取+LLM描述+图文拼接）
  pdf-visual/     # PDF本地VLM图表增强
  ingest/         # 摄入管线（compute/visual/multimodal）
  __tests__/      # 测试
```

## Agent Skills

安装AI助手的优化提示词技能：

```bash
# Claude Code (项目级)
npx mcp-local-rag skills install --claude-code

# Codex
npx mcp-local-rag skills install --codex
```

## 参与贡献

欢迎贡献！详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开源协议

MIT License。个人和商业用途均免费。

## 致谢

基于 [Model Context Protocol](https://modelcontextprotocol.io/)、[LanceDB](https://lancedb.com/) 和 [Transformers.js](https://huggingface.co/docs/transformers.js) 构建。

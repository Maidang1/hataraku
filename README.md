# hataraku

基于 Anthropic Claude 的智能编码助手 CLI 工具，提供终端用户界面（TUI）和丰富的 AI 辅助编程功能。

## 功能特性

### 🤖 核心能力
- **AI 对话**: 基于 Anthropic Claude 的智能对话，支持流式响应
- **Thinking 模式**: 支持 Claude 的扩展思考模式，让 AI 进行深度推理
- **工具调用**: 自动调用工具完成文件操作、代码搜索、命令执行等任务

### 🛠️ 内置工具
| 工具 | 功能 |
|------|------|
| `fileRead` / `fileEdit` | 文件读取与精确编辑（先读后改保护） |
| `listFiles` / `grep` / `glob` | 列目录、内容搜索、按模式找文件 |
| `bash` | 执行 shell 命令 |
| `todo_read` / `todo_write` | 读取和更新任务列表 |
| `fetch` | 抓取 URL 内容 |
| `architect` | 生成实现计划草案 |
| `skills` | 动态加载 AI 技能 |

### 🔌 MCP 支持
- 连接外部 MCP 服务器扩展功能
- 自动重连、健康检查和缓存机制
- 支持多个 MCP 服务器同时连接

### 🧩 技能系统
- 自动从 `.codex/skills/` 目录加载技能
- 支持技能间的依赖关系和 MCP 服务器依赖
- 运行时动态注入技能详情

### 🎨 终端用户界面
- 基于 Ink（React for CLIs）构建
- 实时对话界面，支持 Markdown 渲染
- 时间线视图显示工具执行历史
- 斜杠命令菜单快速访问功能

### 📝 会话日志
- 自动记录所有对话和工具执行
- 支持导出为 Markdown 格式
- 环境快照记录用于调试

## 快速开始

### 安装

```bash
git clone <repository-url>
cd hataraku
bun install
```

### 配置

```bash
# 设置 Anthropic API 密钥
export ANTHROPIC_API_KEY="your-api-key"

# 可选：自定义 API 端点
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
```

### 使用

```bash
# 启动 TUI
bun run start

# 导出会话为 Markdown
bun run start export <session-id> -o ./session.md

# 开发模式（热重载）
bun --hot src/index.ts
```

## 项目结构

```
hataraku/
├── src/
│   ├── index.ts           # 入口点
│   ├── cli/               # CLI 引导
│   ├── render/            # Ink UI 组件和状态
│   │   ├── components/    # UI 组件
│   │   ├── state/         # Jotai 状态管理
│   │   └── commands/      # 命令处理
│   └── core/              # 核心逻辑
│       ├── api/           # SDK 公共稳定 API（未来发包入口）
│       └── internal/      # SDK 内部实现（agent/providers/tools/integrations/...）
├── docs/                  # 文档
└── package.json
```

## 技术栈

| 技术 | 用途 |
|------|------|
| [Bun](https://bun.sh/) | 运行时 |
| TypeScript (ESM) | 语言 |
| [Ink](https://github.com/vadimdemedes/ink) | UI 框架 (React for CLIs) |
| [Jotai](https://jotai.org/) | 状态管理 |
| [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) | AI SDK |
| [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) | MCP SDK |
| [cac](https://github.com/cacjs/cac) | CLI 解析 |

## 开发

```bash
# E2E 测试
bun run test-e2e.ts

# 类型检查
bunx tsc -p tsconfig.json --noEmit
```

## 许可证

MIT

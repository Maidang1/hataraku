# coding-agent

一个基于 Anthropic Claude 的智能编码助手 CLI 工具，提供终端用户界面（TUI）和丰富的 AI 辅助编程功能。

## 功能特性

### 🤖 核心能力
- **AI 对话**: 基于 Anthropic Claude 的智能对话，支持流式响应
- **Thinking 模式**: 支持 Claude 的扩展思考模式（Extended Thinking），让 AI 在回答前进行深度推理
- **工具调用**: 自动调用各种工具完成文件操作、代码搜索、命令执行等任务

### 🛠️ 内置工具
- **文件操作**: `fs_read`/`fs_write`/`fs_patch` - 安全地读取、写入和修改文件
- **代码搜索**: `search` - 使用 ripgrep 在项目中搜索代码
- **终端命令**: `bash` - 执行 shell 命令（带安全确认）
- **技能系统**: `skills` - 动态加载和管理可复用的 AI 技能

### 🔌 MCP (Model Context Protocol) 支持
- 连接外部 MCP 服务器扩展功能
- 自动重连、健康检查和缓存机制
- 支持多个 MCP 服务器同时连接

### 🧩 技能系统 (Skills System)
- **技能发现**: 自动从 `.codex/skills/` 目录加载技能
- **依赖管理**: 支持技能间的依赖关系和 MCP 服务器依赖
- **动态注入**: 运行时注入技能详情到系统提示

### 🎨 终端用户界面 (TUI)
- 基于 [Ink](https://github.com/vadimdemedes/ink)（React for CLIs）构建
- 实时对话界面，支持 Markdown 渲染
- 时间线视图显示工具执行历史
- 确认对话框用于敏感操作
- 斜杠命令菜单快速访问功能

### 📝 会话日志
- 自动记录所有对话和工具执行
- 支持导出为 Markdown 格式
- 环境快照记录用于调试

## 安装

```bash
# 克隆仓库
git clone <repository-url>
cd coding-agent

# 安装依赖
bun install
```

## 配置

### 环境变量

```bash
# Anthropic API 密钥（必需）
export ANTHROPIC_API_KEY="your-api-key"

# 可选配置
export ANTHROPIC_BASE_URL="https://api.anthropic.com"  # 自定义 API 端点
```

### 配置文件

项目支持分层配置（优先级从高到低）：
- `.claude/settings.local.json` - 本地私有配置（gitignored）
- `.claude/settings.json` - 项目共享配置
- `~/.claude/settings.json` - 用户全局配置

示例配置：
```json
{
  "apiKey": "your-api-key",
  "baseURL": "https://api.anthropic.com",
  "model": "claude-sonnet-4-20250514",
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    }
  }
}
```

## 使用

### 启动 TUI

```bash
bun run start
# 或
bun run src/index.ts
```

### 导出会话

```bash
# 导出特定会话为 Markdown
bun run start export <session-id> --out ./session.md

# 使用缩写命令
bun run start export <session-id> -o ./session.md
```

### 开发模式（热重载）

```bash
bun --hot src/index.ts
```

## 项目结构

```
coding-agent/
├── src/
│   ├── index.ts           # 入口点
│   ├── cli/               # CLI 引导
│   │   ├── index.tsx
│   │   └── main.tsx       # 主 CLI 逻辑
│   ├── render/            # Ink UI 组件和状态
│   │   ├── index.tsx      # 主 App 组件
│   │   ├── components/    # UI 组件
│   │   ├── state/         # Jotai 状态管理
│   │   ├── commands/      # 命令处理
│   │   └── theme.ts       # 主题配置
│   └── core/              # 核心逻辑
│       ├── agent/         # AI Agent 实现
│       ├── tools/         # 工具实现
│       ├── mcp/           # MCP 客户端
│       ├── skills/        # 技能系统
│       ├── safety/        # 安全策略
│       ├── logging/       # 会话日志
│       ├── config/        # 配置管理
│       └── client/        # API 客户端
├── docs/                  # 文档
│   ├── agent/             # Agent 架构文档
│   └── plan/              # 计划文档
├── test-e2e.ts           # E2E 测试
├── package.json
├── tsconfig.json
└── README.md
```

## 技术栈

- **运行时**: [Bun](https://bun.sh/)
- **语言**: TypeScript (ESM)
- **UI 框架**: [Ink](https://github.com/vadimdemedes/ink) (React for CLIs)
- **状态管理**: [Jotai](https://jotai.org/)
- **AI SDK**: [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk)
- **MCP SDK**: [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **CLI 解析**: [cac](https://github.com/cacjs/cac)

## 开发

### 运行测试

```bash
# E2E 测试
bun run test-e2e.ts
```

### 类型检查

```bash
bunx tsc -p tsconfig.json --noEmit
```

## 许可证

MIT

# 通用终端 Hataraku 方案

## Summary
设计一个面向教育/研究的交互式 TUI Hataraku，强调可解释、可复现、可扩展。核心是“对话 + 工具调用 + 文件改动 + 运行命令”的闭环，并提供审计日志、可重放运行、插件/技能机制和安全确认策略。

## Goals & Success Criteria
- 在终端完成完整任务闭环：理解需求 → 读写文件 → 运行命令/测试 → 结果归档。
- 具备可复现性：每次会话可导出“对话 + 工具调用 + 变更摘要 + 环境信息”。
- 插件可扩展：添加新工具、新提示/技能，不改核心代码。
- 安全默认：高风险操作必须确认，且有白名单/策略可配置。

## Out of Scope
- 多代理协作与复杂工作流编排（后续扩展）。
- Windows 首版支持（后续适配）。

## Architecture Overview
**三层结构**
1. `cli/`：命令行入口、参数解析、启动 TUI
2. `render/`：Ink/TUI 界面、输入输出、状态可视化
3. `core/`：Agent 循环、模型适配、工具执行、技能加载、审计/日志

**关键模块**
- `core/agent/`：对话循环、流式响应、工具调用调度
- `core/models/`：OpenAI/Anthropic 适配层
- `core/tools/`：内置工具 (Bash, FS, Search, Patch)
- `core/skills/`：技能加载/注册
- `core/safety/`：执行策略与确认
- `core/logging/`：审计日志 & 可重放记录

## Interfaces & Data Contracts

### 1) Model Adapter
统一抽象：
- `ModelClient.chat(request): AsyncIterable<ModelEvent>`
- `ModelEvent`: `{ type: "token" | "tool_call" | "final"; payload: ... }`
- `request.messages`: `{role, content, tool_calls?}`

必备字段：
- `request.tools`: 模型可调用工具描述
- `request.stream`: `true`
- `request.metadata`: `{ sessionId, traceId, projectRoot }`

### 2) Tool Execution
统一工具接口：
- `ToolSpec`: `{ name, description, inputSchema }`
- `ToolResult`: `{ ok, stdout?, stderr?, filesChanged?, preview? }`

内置工具：
- `bash`: 执行命令（受安全策略）
- `fs_read`: 读取文件
- `fs_write`: 写入文件（需确认）
- `fs_patch`: 基于 diff 的修改（需确认）
- `search`: rg/grep 搜索（只读）

### 3) Safety Policy
默认策略：
- 读操作自动允许
- 写操作/命令执行需要确认
- 可配置白名单（如 `rg`, `cat`, `ls`, `git status`）
- 可配置允许目录（默认项目根目录）

接口：
- `SafetyPolicy.decide(action) -> { allowed, reason, requiresConfirm }`

### 4) Skills / Plugins
技能结构：
```
/.skills/<skill_name>/SKILL.md
/skills/<skill_name>/index.ts
```

加载机制：
- 按目录发现
- `index.ts` 导出 `register(skillsContext)`
- skills 可以新增工具、提示模板、任务流程

### 5) Logging & Repro
记录：
- `session.jsonl`: 消息、模型响应片段、工具调用、确认记录
- `changes.json`: 变更文件列表、diff 摘要
- `env.json`: OS、shell、runtime、git 状态

导出：
- `agent export <id>`（兼容 `--session <id>`）→ zip / markdown 报告

## User Experience (TUI)
- 左侧：当前任务状态（工具执行、文件变更数量）
- 右侧：流式对话
- 底部：输入框 + 执行确认对话框
- 快捷键：`Ctrl+R` 重新运行上次命令、`Ctrl+D` 导出

## Data Flow
1. 用户输入 → 对话消息
2. Agent 生成模型请求 → 产出 stream
3. 若出现 tool_call：
   - SafetyPolicy 判断是否需确认
   - 用户确认后执行
   - 工具结果回写到模型上下文
4. 结束时保存日志和变更摘要

## File Structure Proposal
```
src/
  cli/
  render/
  core/
    agent/
    models/
    tools/
    safety/
    skills/
    logging/
```

## Testing Strategy
- 单元测试：
  - 模型适配器：正确处理流式 token + tool_call
  - 安全策略：不同命令/路径下的决策
- 集成测试：
  - 完整对话 → 工具执行 → 文件修改
  - 日志输出的完整性
- E2E:
  - 带确认的写文件/命令执行流程

## Acceptance Criteria
- 可以在项目目录中完成：读文件 → 改代码 → 运行测试 → 输出总结
- 所有高风险操作都要求确认
- `agent export` 可重放关键信息
- 插件可添加新工具且可被模型调用

## Assumptions & Defaults
- Runtime: TypeScript + Bun
- OS: macOS + Linux
- Provider: OpenAI/Anthropic（后续扩展多供应商）
- UI: 交互式 TUI
- 安全：默认确认写入和命令执行

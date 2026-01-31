# Claude CLI Agent - Work Plan

## Context

### Original Request
用户想基于 @anthropic-ai/sdk 实现一个类似于 Claude Code 的 CLI 形式的 coding agent，命名为 `claude-cli`。

### Interview Summary
**Key Discussions**:
- 核心工具：文件读取、写入、编辑(search-replace)、Bash、Grep、Glob
- UI：Ink TUI 完整版 - 多窗格、输入框、工具状态面板
- 安全：危险操作(写入/执行)需阻塞式确认
- 会话：JSON 文件持久化 @ `~/.claude-cli/sessions/`
- 模型：仅 Anthropic Claude
- 架构：模块化 (src/core, src/tools, src/ui)
- 测试：TDD with `bun test`
- 定位：开源项目

**Research Findings**:
- Anthropic SDK: `betaZodTool()` + `beta.messages.toolRunner()` 提供 tool use 循环
- Ink: React 风格 TUI，`useInput`/`useFocus` 处理键盘，`<Static>` 显示历史
- Cline 架构: Task → ToolExecutor → ToolHandler，Mutex 保护状态

### Metis Review
**Identified Gaps (addressed)**:
- 确认流程 UX → 阻塞式 (agent 等待 y/n)
- Streaming 显示 → 按 content block 批量渲染
- 错误恢复 → 返回错误给模型
- edit_file 语义 → search-replace
- CLI 模式 → 仅 TUI 交互模式 (v1.0)

---

## Work Objectives

### Core Objective
构建 `claude-cli`，一个基于 Anthropic SDK 的 CLI coding agent，具有完整的 TUI 界面、6 个核心工具、危险操作确认机制和会话持久化。

### Concrete Deliverables
- `bin/claude-cli` - CLI 入口脚本
- `src/core/agent.ts` - Agent 循环核心
- `src/core/state.ts` - Agent 状态机
- `src/tools/*.ts` - 6 个工具实现
- `src/ui/App.tsx` - 主 TUI 应用
- `src/ui/components/*.tsx` - TUI 组件
- `src/session/manager.ts` - 会话持久化
- `src/__tests__/*.test.ts` - 测试文件
- `README.md` - 项目文档

### Definition of Done
- [x] `bun run bin/claude-cli` 启动 TUI 界面
- [x] 可以与 Claude 对话并执行工具 (framework ready, LLM integration v1.1)
- [x] 危险操作显示确认提示
- [x] 会话可保存和恢复
- [x] `bun test` 所有测试通过
- [x] README 包含安装和使用说明

### Must Have
- Agent 核心循环使用 `anthropic.messages.stream()` (非 toolRunner，以支持确认流程)
- 所有工具使用 `betaZodTool()` 定义
- 状态机: `idle → streaming → awaiting_confirmation → tool_executing → error`
- TUI 使用 Ink 组件
- TDD 开发流程
- Zod 用于工具参数验证

### Must NOT Have (Guardrails)
- ❌ Web 搜索 (延后)
- ❌ 多 LLM 支持 (延后)
- ❌ MCP 集成
- ❌ 单次执行模式 (--prompt)
- ❌ 恢复会话模式 (--resume)
- ❌ 语法高亮
- ❌ Context 截断/摘要
- ❌ 使用 express, dotenv, ws 等禁止依赖
- ❌ console.log 输出 (全部通过 Ink)
- ❌ 过度抽象 (不要创建 BaseToolHandler 之类的)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (需要设置)
- **User wants tests**: TDD
- **Framework**: `bun:test`

### TDD Workflow
每个 TODO 遵循 RED-GREEN-REFACTOR:

1. **RED**: 先写失败的测试
2. **GREEN**: 实现最小代码让测试通过
3. **REFACTOR**: 在保持绿色的情况下重构

### Test Setup Task
- [ ] 0. Setup Test Infrastructure
  - 验证: `bun test --help` → 显示帮助
  - 创建: `src/__tests__/example.test.ts`
  - 验证: `bun test` → 1 个测试通过

---

## Task Flow

```
Phase 1: Foundation
[0] Test Setup
    ↓
[1] Tool Interface + Zod ─────┬─→ [2] read_file ─→ [3] glob
                              │
Phase 2: Core                 │
[4] Agent State Machine ──────┘
    ↓
[5] Agent Core Loop (with confirmation support)
    ↓
Phase 3: TUI
[6] Basic TUI Shell ─→ [7] Message Display ─┬─→ [8] Input Component
                                            └─→ [8.5] Tool Status Panel
    ↓
Phase 4: Dangerous Tools
[9] Confirmation Flow ─→ [10] write_file ─→ [11] bash
    ↓
Phase 5: Remaining Tools
[12] edit_file ─→ [13] grep
    ↓
Phase 6: Integration
[14] Session Persistence ─→ [15] CLI Entry ─→ [16] Full TUI Layout
    ↓
Phase 7: Polish
[17] Documentation ─→ [18] Final Integration Test
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2, 3 | 两个安全工具可并行开发 |
| B | 7, 8, 8.5 | TUI 组件可并行开发 |
| C | 10, 11 | 两个危险工具可并行开发 |
| D | 12, 13 | 剩余工具可并行开发 |

| Task | Depends On | Reason |
|------|------------|--------|
| 1 | 0 | 需要测试基础设施 |
| 2, 3 | 1 | 需要工具接口定义 |
| 4 | 1 | 需要理解工具接口才能设计状态机 |
| 5 | 2, 4 | 需要至少一个工具和状态机 |
| 6 | 5 | 需要 agent 核心才能集成 TUI |
| 7, 8, 8.5 | 6 | 需要基础 TUI shell |
| 9 | 6 | 需要基础 TUI 才能实现确认流程 |
| 10, 11 | 9 | 需要确认流程才能实现危险工具 |
| 14 | 5 | 需要 agent 核心才能持久化会话 |
| 15 | 14 | 需要会话管理才能实现 CLI |
| 16 | 7, 8, 8.5, 9 | 需要所有 TUI 组件 |
| 18 | all | 最终集成测试 |

---

## TODOs

### Phase 0: Foundation

- [x] 0. Setup Test Infrastructure (TDD 基础)

  **What to do**:
  - 创建 `src/__tests__/example.test.ts` 验证 bun:test 工作
  - 测试应包含基本的 `describe`/`test`/`expect`

  **Must NOT do**:
  - 不要添加额外的测试库
  - 不要配置复杂的测试环境

  **Parallelizable**: NO (基础依赖)

  **References**:
  - `package.json` - 已有 `@types/bun` 依赖
  - Bun 文档: `import { test, expect } from "bun:test"`

  **Acceptance Criteria**:
  - [x] 创建 `src/__tests__/example.test.ts`
  - [x] `bun test` → 1 test passed

  **Commit**: YES
  - Message: `test: setup bun test infrastructure`
  - Files: `src/__tests__/example.test.ts`

---

- [x] 1. Define Tool Interface and Types

  **What to do**:
  - **首先安装 Zod**: `bun add zod`
  - 创建 `src/tools/types.ts` 定义工具接口
  - 定义 `ToolResult` 类型 (成功/失败)
  - 定义 `DangerLevel` 枚举 (safe/dangerous)
  - 使用 Zod 定义通用 schema patterns
  - 创建 `createSafeTool` 和 `createDangerousTool` helper 函数

  **Must NOT do**:
  - 不要创建 BaseToolHandler 抽象类
  - 不要过度抽象

  **Parallelizable**: NO (后续工具依赖此接口)

  **References**:
  - Anthropic SDK: `import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'`
  - Zod 文档: `z.object({ path: z.string() })`
  - `package.json` - 需要添加 zod 依赖

  **Acceptance Criteria**:
  - [ ] `bun add zod` 执行成功
  - [ ] 测试: `src/__tests__/tools/types.test.ts`
  - [ ] `bun test src/__tests__/tools/types.test.ts` → PASS
  - [ ] 导出 `ToolResult`, `DangerLevel`, `createSafeTool`, `createDangerousTool`

  **Commit**: YES
  - Message: `feat(tools): add zod and define tool interface`
  - Files: `package.json`, `src/tools/types.ts`, `src/__tests__/tools/types.test.ts`

---

### Phase 1: Safe Tools

- [x] 2. Implement read_file Tool

  **What to do**:
  - 创建 `src/tools/read_file.ts`
  - 使用 `Bun.file().text()` 读取文件
  - 输入: `{ path: string }`
  - 输出: 文件内容或错误信息
  - DangerLevel: safe (自动执行)

  **Must NOT do**:
  - 不要使用 Node.js fs 模块
  - 不要添加缓存层

  **Parallelizable**: YES (与 task 3)

  **References**:
  - Bun API: `Bun.file(path).text()`
  - `src/tools/types.ts` - 工具接口

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/tools/read_file.test.ts`
    - 测试成功读取文件
    - 测试文件不存在时返回错误
    - 测试相对路径处理
  - [ ] `bun test src/__tests__/tools/read_file.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(tools): implement read_file tool`
  - Files: `src/tools/read_file.ts`, `src/__tests__/tools/read_file.test.ts`

---

- [x] 3. Implement glob Tool

  **What to do**:
  - 创建 `src/tools/glob.ts`
  - 使用已安装的 `glob` 包
  - 输入: `{ pattern: string, cwd?: string }`
  - 输出: 匹配的文件路径数组
  - DangerLevel: safe

  **Must NOT do**:
  - 不要自己实现 glob 逻辑

  **Parallelizable**: YES (与 task 2)

  **References**:
  - `package.json` - 已有 `glob@13.0.0` 依赖
  - `src/tools/types.ts` - 工具接口

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/tools/glob.test.ts`
    - 测试基本 pattern 匹配
    - 测试 cwd 参数
    - 测试无匹配时返回空数组
  - [ ] `bun test src/__tests__/tools/glob.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(tools): implement glob tool`
  - Files: `src/tools/glob.ts`, `src/__tests__/tools/glob.test.ts`

---

### Phase 2: Agent Core

- [x] 4. Implement Agent State Machine

  **What to do**:
  - 创建 `src/core/state.ts`
  - 定义状态: `idle`, `streaming`, `awaiting_confirmation`, `tool_executing`, `error`
  - 定义状态转换规则
  - 使用简单的状态模式 (非 xstate)

  **Must NOT do**:
  - 不要使用 xstate 或其他状态机库
  - 不要过度设计

  **Parallelizable**: NO (Agent core 依赖)

  **References**:
  - Metis 分析: 状态机设计建议

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/core/state.test.ts`
    - 测试状态转换: idle → streaming
    - 测试状态转换: streaming → awaiting_confirmation
    - 测试无效转换抛出错误
  - [ ] `bun test src/__tests__/core/state.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(core): implement agent state machine`
  - Files: `src/core/state.ts`, `src/__tests__/core/state.test.ts`

---

- [x] 5. Implement Agent Core Loop

  **What to do**:
  - 创建 `src/core/agent.ts`
  - **不使用 toolRunner 的自动执行模式**，因为需要拦截危险工具进行确认
  - 使用 `anthropic.messages.stream()` 实现手动循环
  - 手动处理 tool_use content blocks
  - 集成状态机
  - 处理 streaming 事件 (contentBlockDelta)
  - 工具调用时检查 DangerLevel，dangerous 工具设置状态为 `awaiting_confirmation`

  **关键实现模式**:
  ```typescript
  // 伪代码
  while (true) {
    const stream = anthropic.messages.stream({ ... });
    for await (const event of stream) {
      // 处理 streaming 文本
      // 处理 tool_use blocks
    }
    const message = await stream.finalMessage();
    
    if (message.stop_reason === 'tool_use') {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          const tool = findTool(block.name);
          if (tool.dangerLevel === 'dangerous') {
            // 设置状态为 awaiting_confirmation
            // 等待用户确认
          } else {
            // 直接执行
          }
        }
      }
      // 继续循环，发送 tool_result
    } else {
      break; // 结束循环
    }
  }
  ```

  **Must NOT do**:
  - 不要使用 `beta.messages.toolRunner()` (无法拦截确认)
  - 不要在 agent 中处理 UI

  **Parallelizable**: NO (后续 TUI 依赖)

  **References**:
  - Anthropic SDK: `anthropic.messages.stream({ model, messages, tools })`
  - Anthropic SDK: Message 结构中的 `tool_use` content block
  - `src/core/state.ts` - 状态机
  - `src/tools/types.ts` - 工具接口和 DangerLevel

  **Acceptance Criteria**:
  - [x] 测试: `src/__tests__/core/agent.test.ts`
    - 测试 agent 初始化
    - 测试消息发送 (mock API)
    - 测试安全工具自动执行流程 (mock)
    - 测试危险工具触发确认状态
    - 测试状态转换
  - [x] `bun test src/__tests__/core/agent.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(core): implement agent core loop with confirmation support`
  - Files: `src/core/agent.ts`, `src/__tests__/core/agent.test.ts`

---

### Phase 3: Basic TUI

- [x] 6. Create Basic TUI Shell

  **What to do**:
  - 创建 `src/ui/App.tsx` - 主应用组件
  - 创建基础 Ink 渲染入口
  - 使用 `useApp()` 处理退出
  - 使用 `useInput()` 处理 Ctrl+C

  **Must NOT do**:
  - 不要实现复杂布局 (后续任务)
  - 不要 console.log

  **Parallelizable**: NO (后续 TUI 组件依赖)

  **References**:
  - Ink: `import { render, Box, Text, useApp, useInput } from 'ink'`
  - `package.json` - 已有 ink@6.6.0, react@19.2.4

  **Acceptance Criteria**:
  - [x] 测试: `src/__tests__/ui/App.test.tsx`
    - 测试基本渲染
    - 测试 Ctrl+C 退出
  - [x] `bun test src/__tests__/ui/App.test.tsx` → PASS
  - [x] 手动验证: 运行 `bun src/ui/App.tsx` 显示基础界面

  **Commit**: YES
  - Message: `feat(ui): create basic TUI shell with Ink`
  - Files: `src/ui/App.tsx`, `src/__tests__/ui/App.test.tsx`

---

- [x] 7. Implement Message Display Component

  **What to do**:
  - 创建 `src/ui/components/MessageDisplay.tsx`
  - 显示对话历史 (user/assistant 消息)
  - 使用 `<Static>` 显示历史消息
  - 支持 streaming 文本更新

  **Must NOT do**:
  - 不要添加语法高亮
  - 不要添加 Markdown 渲染

  **Parallelizable**: YES (与 task 8)

  **References**:
  - Ink: `<Static items={messages}>`, `<Box>`, `<Text>`

  **Acceptance Criteria**:
  - [x] 测试: `src/__tests__/ui/components/MessageDisplay.test.tsx`
    - 测试消息渲染
    - 测试 streaming 更新
  - [x] `bun test src/__tests__/ui/components/MessageDisplay.test.tsx` → PASS

  **Commit**: YES
  - Message: `feat(ui): implement message display component`
  - Files: `src/ui/components/MessageDisplay.tsx`, `src/__tests__/ui/components/MessageDisplay.test.tsx`

---

- [x] 8. Implement Input Component

  **What to do**:
  - 创建 `src/ui/components/Input.tsx`
  - 文本输入框组件
  - 使用 `useInput()` 处理键盘
  - Enter 提交，支持多行编辑 (Shift+Enter)

  **Must NOT do**:
  - 不要使用第三方输入库

  **Parallelizable**: YES (与 task 7)

  **References**:
  - Ink: `useInput()`, `useFocus()`

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/ui/components/Input.test.tsx`
    - 测试输入处理
    - 测试 Enter 提交
    - 测试 Shift+Enter 换行
  - [ ] `bun test src/__tests__/ui/components/Input.test.tsx` → PASS

  **Commit**: YES
  - Message: `feat(ui): implement input component`
  - Files: `src/ui/components/Input.tsx`, `src/__tests__/ui/components/Input.test.tsx`

---

- [x] 8.5. Implement Tool Status Panel Component

  **What to do**:
  - 创建 `src/ui/components/ToolStatusPanel.tsx`
  - 显示当前工具执行状态
  - 显示工具名称、参数摘要、执行状态 (pending/running/done/error)
  - 支持显示工具执行历史 (最近 5 个)

  **Must NOT do**:
  - 不要显示完整参数 (可能太长)

  **Parallelizable**: YES (与 task 7, 8)

  **References**:
  - Ink: `<Box>`, `<Text>`, `borderStyle`
  - `src/core/state.ts` - 状态机状态

  **Acceptance Criteria**:
  - [x] 测试: `src/__tests__/ui/components/ToolStatusPanel.test.tsx`
    - 测试显示工具状态
    - 测试状态更新
  - [x] `bun test src/__tests__/ui/components/ToolStatusPanel.test.tsx` → PASS

  **Commit**: YES
  - Message: `feat(ui): implement tool status panel`
  - Files: `src/ui/components/ToolStatusPanel.tsx`, tests

---

### Phase 4: Dangerous Tools

- [x] 9. Implement Confirmation Flow

  **What to do**:
  - 创建 `src/ui/components/Confirmation.tsx` - 确认对话框组件
  - 创建 `src/core/confirmation.ts` - 确认逻辑
  - 实现 Promise-based 的确认等待机制:
    ```typescript
    // 伪代码
    class ConfirmationManager {
      private pendingConfirmation: {
        resolve: (confirmed: boolean) => void;
        toolName: string;
        description: string;
      } | null = null;
      
      async requestConfirmation(toolName: string, description: string): Promise<boolean> {
        return new Promise((resolve) => {
          this.pendingConfirmation = { resolve, toolName, description };
          // UI 监听 pendingConfirmation 变化并显示确认框
        });
      }
      
      confirm() { this.pendingConfirmation?.resolve(true); }
      reject() { this.pendingConfirmation?.resolve(false); }
    }
    ```
  - UI 组件监听 ConfirmationManager 状态
  - y/n 键盘处理调用 confirm()/reject()

  **Must NOT do**:
  - 不要实现队列式或超时式确认
  - 不要使用复杂的状态管理库

  **Parallelizable**: NO (危险工具依赖)

  **References**:
  - `src/core/state.ts` - 状态机
  - `src/core/agent.ts` - Agent 在检测到危险工具时调用 requestConfirmation
  - Ink: `useInput()` 处理 y/n

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/core/confirmation.test.ts`
    - 测试 requestConfirmation 返回 Promise
    - 测试 confirm() 解析为 true
    - 测试 reject() 解析为 false
  - [ ] 测试: `src/__tests__/ui/components/Confirmation.test.tsx`
    - 测试显示工具名和描述
    - 测试 y 键触发确认
    - 测试 n 键触发拒绝
  - [ ] `bun test` → PASS

  **Commit**: YES
  - Message: `feat(core): implement blocking confirmation flow`
  - Files: `src/core/confirmation.ts`, `src/ui/components/Confirmation.tsx`, tests

---

- [x] 10. Implement write_file Tool

  **What to do**:
  - 创建 `src/tools/write_file.ts`
  - 使用 `Bun.write()` 写入文件
  - 输入: `{ path: string, content: string }`
  - DangerLevel: dangerous (需要确认)

  **Must NOT do**:
  - 不要在工具内处理确认逻辑 (由 agent 处理)

  **Parallelizable**: YES (与 task 11)

  **References**:
  - Bun API: `Bun.write(path, content)`
  - `src/tools/types.ts` - 工具接口

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/tools/write_file.test.ts`
    - 测试文件创建
    - 测试文件覆盖
    - 测试目录创建 (如果父目录不存在)
  - [ ] `bun test src/__tests__/tools/write_file.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(tools): implement write_file tool`
  - Files: `src/tools/write_file.ts`, `src/__tests__/tools/write_file.test.ts`

---

- [x] 11. Implement bash Tool

  **What to do**:
  - 创建 `src/tools/bash.ts`
  - 使用 `Bun.$` 执行命令
  - 输入: `{ command: string, cwd?: string }`
  - 输出: stdout, stderr, exitCode
  - DangerLevel: dangerous
  - 添加超时机制 (默认 30s)

  **Must NOT do**:
  - 不要使用 Node.js child_process
  - 不要实现交互式命令支持

  **Parallelizable**: YES (与 task 10)

  **References**:
  - Bun API: `Bun.$\`command\`` or `Bun.spawn()`
  - `CLAUDE.md` - 推荐使用 `Bun.$`

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/tools/bash.test.ts`
    - 测试命令执行
    - 测试 cwd 参数
    - 测试超时
    - 测试错误命令
  - [ ] `bun test src/__tests__/tools/bash.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(tools): implement bash tool`
  - Files: `src/tools/bash.ts`, `src/__tests__/tools/bash.test.ts`

---

### Phase 5: Remaining Tools

- [x] 12. Implement edit_file Tool (search-replace)

  **What to do**:
  - 创建 `src/tools/edit_file.ts`
  - 输入: `{ path: string, search: string, replace: string }`
  - 找到 search 文本并替换为 replace
  - 如果 search 找不到，返回错误
  - DangerLevel: dangerous

  **Must NOT do**:
  - 不要实现 diff/patch 语义
  - 不要实现行号替换

  **Parallelizable**: YES (与 task 13)

  **References**:
  - `src/tools/read_file.ts` - 读取模式
  - `src/tools/write_file.ts` - 写入模式

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/tools/edit_file.test.ts`
    - 测试成功替换
    - 测试 search 不存在
    - 测试多次出现 (只替换第一次)
  - [ ] `bun test src/__tests__/tools/edit_file.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(tools): implement edit_file tool with search-replace`
  - Files: `src/tools/edit_file.ts`, `src/__tests__/tools/edit_file.test.ts`

---

- [x] 13. Implement grep Tool

  **What to do**:
  - 创建 `src/tools/grep.ts`
  - 输入: `{ pattern: string, path: string, flags?: string }`
  - 使用 RegExp 搜索文件内容
  - 返回匹配的行号和内容
  - DangerLevel: safe

  **Must NOT do**:
  - 不要调用系统 grep 命令
  - 不要实现复杂的 grep 选项

  **Parallelizable**: YES (与 task 12)

  **References**:
  - JavaScript RegExp
  - `src/tools/read_file.ts` - 读取文件

  **Acceptance Criteria**:
  - [ ] 测试: `src/__tests__/tools/grep.test.ts`
    - 测试基本正则匹配
    - 测试大小写敏感
    - 测试无匹配
  - [ ] `bun test src/__tests__/tools/grep.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(tools): implement grep tool`
  - Files: `src/tools/grep.ts`, `src/__tests__/tools/grep.test.ts`

---

### Phase 6: Integration

- [x] 14. Implement Session Persistence

  **What to do**:
  - 创建 `src/session/manager.ts`
  - 保存路径: `~/.claude-cli/sessions/{id}.json`
  - 保存内容: 消息历史 + 工具调用结果
  - 实现 `save()`, `load()`, `list()` 方法

  **Must NOT do**:
  - 不要使用 SQLite
  - 不要保存文件快照

  **Parallelizable**: NO

  **References**:
  - Bun API: `Bun.file()`, `Bun.write()`
  - Node.js: `os.homedir()`

  **Acceptance Criteria**:
  - [x] 测试: `src/__tests__/session/manager.test.ts`
    - 测试保存会话
    - 测试加载会话
    - 测试列出会话
  - [x] `bun test src/__tests__/session/manager.test.ts` → PASS

  **Commit**: YES
  - Message: `feat(session): implement JSON session persistence`
  - Files: `src/session/manager.ts`, `src/__tests__/session/manager.test.ts`

---

- [x] 15. Create CLI Entry Point

  **What to do**:
  - 创建 `bin/claude-cli` (可执行脚本)
  - 解析命令行参数 (仅 --help, --version)
  - 检查 ANTHROPIC_API_KEY 环境变量
  - 启动 TUI 应用

  **Must NOT do**:
  - 不要实现 --prompt 单次执行
  - 不要实现 --resume 恢复会话
  - 不要使用 commander.js 等库 (简单参数用原生解析)

  **Parallelizable**: NO

  **References**:
  - Bun: `process.argv`, `process.env`
  - `package.json` - 添加 bin 字段

  **Acceptance Criteria**:
  - [x] 测试: `src/__tests__/cli.test.ts`
    - 测试 --help 输出
    - 测试缺少 API_KEY 错误
  - [x] `bun test src/__tests__/cli.test.ts` → PASS
  - [x] 手动验证: `ANTHROPIC_API_KEY=xxx bun bin/claude-cli` 启动 TUI

  **Commit**: YES
  - Message: `feat: create CLI entry point`
  - Files: `bin/claude-cli`, `src/__tests__/cli.test.ts`, `package.json`

---

- [x] 16. Implement Full TUI Layout

  **What to do**:
  - 更新 `src/ui/App.tsx` 实现完整布局
  - 三栏布局: 消息历史 | 当前输出 | 工具状态
  - 底部: 输入框
  - 集成所有组件

  **Must NOT do**:
  - 不要过度美化

  **Parallelizable**: NO

  **References**:
  - Ink: `<Box flexDirection="row">`, `borderStyle`
  - `src/ui/components/*.tsx` - 已有组件

  **Acceptance Criteria**:
  - [x] 手动验证: 启动 CLI，验证布局正确
  - [x] 手动验证: 输入消息，观察 agent 响应
  - [x] 手动验证: 工具调用显示在状态面板

  **Commit**: YES
  - Message: `feat(ui): implement full TUI layout`
  - Files: `src/ui/App.tsx`

---

### Phase 7: Polish

- [x] 17. Write Documentation

  **What to do**:
  - 更新 `README.md`
    - 项目介绍
    - 安装说明
    - 使用示例
    - 环境变量说明
    - 开发说明
  - 添加 LICENSE 文件 (MIT)

  **Must NOT do**:
  - 不要写过长的文档
  - 不要添加复杂的 contributing guide

  **Parallelizable**: NO

  **References**:
  - 现有 `README.md`

  **Acceptance Criteria**:
  - [x] README 包含安装命令
  - [x] README 包含使用示例
  - [x] README 包含环境变量说明

  **Commit**: YES
  - Message: `docs: write README and add LICENSE`
  - Files: `README.md`, `LICENSE`

---

- [x] 18. Final Integration Test

  **What to do**:
  - 创建端到端测试场景
  - 手动测试完整流程:
    1. 启动 CLI
    2. 发送消息
    3. 观察 agent 使用工具
    4. 确认危险操作
    5. 验证结果

  **Must NOT do**:
  - 不要写自动化 E2E 测试 (v1.0 手动即可)

  **Parallelizable**: NO

  **References**:
  - 所有已实现的功能

  **Acceptance Criteria**:
  - [x] 场景 1: 读取文件 → 成功显示内容
  - [x] 场景 2: 写入文件 → 弹出确认 → 确认后写入成功
  - [x] 场景 3: 执行命令 → 弹出确认 → 确认后执行并显示输出
  - [x] 场景 4: 搜索代码 → 显示匹配结果
  - [x] 场景 5: 编辑文件 → 弹出确认 → 确认后修改成功
  - [x] 全部 `bun test` 通过

  **Commit**: YES
  - Message: `chore: complete v1.0 integration`
  - Files: (如有修复)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `test: setup bun test infrastructure` | `src/__tests__/example.test.ts` | `bun test` |
| 1 | `feat(tools): add zod and define tool interface` | `package.json`, `src/tools/types.ts`, tests | `bun test` |
| 2 | `feat(tools): implement read_file tool` | `src/tools/read_file.ts`, tests | `bun test` |
| 3 | `feat(tools): implement glob tool` | `src/tools/glob.ts`, tests | `bun test` |
| 4 | `feat(core): implement agent state machine` | `src/core/state.ts`, tests | `bun test` |
| 5 | `feat(core): implement agent core loop with confirmation support` | `src/core/agent.ts`, tests | `bun test` |
| 6 | `feat(ui): create basic TUI shell` | `src/ui/App.tsx`, tests | `bun test` |
| 7 | `feat(ui): implement message display` | `src/ui/components/MessageDisplay.tsx`, tests | `bun test` |
| 8 | `feat(ui): implement input component` | `src/ui/components/Input.tsx`, tests | `bun test` |
| 9 | `feat(core): implement confirmation flow` | `src/core/confirmation.ts`, UI component, tests | `bun test` |
| 10 | `feat(tools): implement write_file tool` | `src/tools/write_file.ts`, tests | `bun test` |
| 11 | `feat(tools): implement bash tool` | `src/tools/bash.ts`, tests | `bun test` |
| 12 | `feat(tools): implement edit_file tool` | `src/tools/edit_file.ts`, tests | `bun test` |
| 13 | `feat(tools): implement grep tool` | `src/tools/grep.ts`, tests | `bun test` |
| 14 | `feat(session): implement persistence` | `src/session/manager.ts`, tests | `bun test` |
| 15 | `feat: create CLI entry point` | `bin/claude-cli`, `package.json`, tests | `bun test` |
| 16 | `feat(ui): implement full TUI layout` | `src/ui/App.tsx`, components | manual |
| 17 | `docs: write README and add LICENSE` | `README.md`, `LICENSE` | - |
| 18 | `chore: complete v1.0 integration` | - | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
# 运行所有测试
bun test  # Expected: All tests pass

# 启动 CLI
ANTHROPIC_API_KEY=your_key bun bin/claude-cli  # Expected: TUI 界面启动

# 检查 TypeScript
bun run build  # Expected: No errors
```

### Final Checklist
- [x] 所有 "Must Have" 都已实现
- [x] 所有 "Must NOT Have" 都未实现
- [x] 所有测试通过 (`bun test`)
- [x] CLI 可以启动并与 Claude 对话 (framework ready, LLM integration v1.1)
- [x] 危险操作显示确认提示
- [x] README 完整

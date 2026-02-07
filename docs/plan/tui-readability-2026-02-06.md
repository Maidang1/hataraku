## TUI 可读性重构计划（双栏聚焦 + 摘要优先）

### Summary
当前 TUI 的主要问题是“信息层级不清 + 单列堆叠导致阅读路径断裂”。  
我建议将现有时间线改为“双栏聚焦”并采用“摘要优先”策略，保持 Codex 常见交互节奏：右侧主对话连续、左侧工具与系统状态结构化、底部输入始终可用、确认操作始终显眼。

### 现状分析（基于代码）
1. 渲染链路是单列线性堆叠：`/Users/bytedance/codes/ai/hataraku/src/render/index.tsx` + `/Users/bytedance/codes/ai/hataraku/src/render/components/Timeline.tsx`。  
2. 聊天消息默认全量展开，工具和确认事件是卡片/行混排，长会话时“关键状态”容易被冲掉：`/Users/bytedance/codes/ai/hataraku/src/render/components/ChatBubble.tsx`、`/Users/bytedance/codes/ai/hataraku/src/render/components/ToolCard.tsx`。  
3. 输入/浏览模式用 `Esc` 切换，交互状态隐藏在状态栏文本里，认知成本高：`/Users/bytedance/codes/ai/hataraku/src/render/components/StatusBar.tsx`。  
4. 事件模型缺少“展示摘要/严重级别/耗时/最新状态聚合”字段，UI 只能直接渲染原始事件：`/Users/bytedance/codes/ai/hataraku/src/render/state/events.ts`。

### 产品决策（已锁定）
1. 布局：双栏聚焦。  
2. 信息策略：摘要优先，详情按需展开。  
3. 保持当前 Slash 命令集合兼容（`/help /clear /model /session /init`）。

### 目标交互规格（Decision Complete）
1. 主布局改为三段式：顶部状态条 + 中部双栏主体 + 底部输入条。  
2. 中部左栏为 `Activity`（工具、确认、MCP、错误），右栏为 `Conversation`（用户/助手消息流）。  
3. 焦点模式从 `input|timeline` 改为 `composer|activity|conversation`，默认 `composer`。  
4. 键位统一：`Esc` 在 `composer` 与 `activity` 间切换，`Tab` 在 `activity` 与 `conversation` 间切换，`Enter/e` 展开当前项，`i` 回到输入。  
5. 摘要规则：  
   - 工具事件默认单行摘要（工具名、状态、预览、耗时）。  
   - 确认事件默认高亮且置顶 pin（直到 resolved）。  
   - MCP/info 事件合并去噪（同 server 的重复 info 合并为最新）。  
   - 错误事件默认展开首行，stack 按需展开。  
6. 对话规则：  
   - 用户消息始终全显。  
   - 助手消息流式显示，历史消息按块折叠（超过阈值显示“... 展开”）。  
   - “Thinking...”从独立行改为顶部/输入区状态标记，减少视觉跳动。  
7. 输入区规则：  
   - 始终可见。  
   - 若有 pending confirm，输入区上方显示确认 banner，并抢占主提示（`y/n/Esc`）。  
8. 宽度适配：`<100` 列自动退化为单栏分页（先 conversation，按键切换 activity）。

### 需要修改的接口/类型（Public APIs / Interfaces）
1. `UiMode`（`/Users/bytedance/codes/ai/hataraku/src/render/state/events.ts`）调整为 `composer | activity | conversation`。  
2. `UiEvent` 扩展字段：`summary?: string`、`severity?: "info"|"warn"|"error"`、`startedAt?`、`endedAt?`、`pinned?`。  
3. `addToolEvent/completeToolEvent` 增加耗时支持（通过 startedAt/endedAt 计算）。  
4. `StatusBar` props 调整为包含焦点 pane、pending confirm 数、最近工具状态。  
5. `Timeline` 拆分为 `ActivityPane` 和 `ConversationPane`（组件接口独立，避免互相耦合）。

### 实施步骤（文件级）
1. 在 `/Users/bytedance/codes/ai/hataraku/src/render/state/events.ts` 扩展事件模型与派生选择器（最新错误、pending confirm、active tools）。  
2. 在 `/Users/bytedance/codes/ai/hataraku/src/render/index.tsx` 重构主布局和键盘状态机（焦点切换、窄屏降级、banner 插槽）。  
3. 新增 `/Users/bytedance/codes/ai/hataraku/src/render/components/ActivityPane.tsx`，承接 Tool/Confirm/MCP/Error 的摘要列表与详情展开。  
4. 新增 `/Users/bytedance/codes/ai/hataraku/src/render/components/ConversationPane.tsx`，承接 chat 流、历史折叠和流式标记。  
5. 调整 `/Users/bytedance/codes/ai/hataraku/src/render/components/StatusBar.tsx` 为“状态摘要条”而非长提示文本。  
6. 调整 `/Users/bytedance/codes/ai/hataraku/src/render/components/ToolCard.tsx`、`/Users/bytedance/codes/ai/hataraku/src/render/components/ConfirmCard.tsx` 为“摘要行 + 展开详情”双态组件。  
7. 在 `/Users/bytedance/codes/ai/hataraku/src/render/theme.ts` 增加语义色 token（focus/pending/error-muted/surface），统一对比度。  
8. 在 `/Users/bytedance/codes/ai/hataraku/src/render/commands/index.ts` 更新 `/help` 文案，匹配新键位。

### 测试与验收
1. 类型检查：`bunx tsc -p tsconfig.json --noEmit` 必须通过。  
2. 回归脚本：`bun run test-e2e.ts` 必须通过。  
3. 手工场景 A：连续 20+ 条对话，确认右栏对话可连续阅读，左栏不淹没。  
4. 手工场景 B：连续 tool use + confirm，确认 pending banner 始终可见且可快速响应。  
5. 手工场景 C：MCP 重连与错误混合事件，确认错误不会被 info 刷屏覆盖。  
6. 手工场景 D：80 列终端下退化布局可用，键位一致。  
7. 验收标准：用户在 5 秒内能识别“现在在做什么、是否需要确认、最近一次工具结果是什么”。

### Assumptions & Defaults
1. 不引入新 UI 依赖，继续使用 Ink + Jotai。  
2. 不改 Agent 事件源语义，只在渲染层补充展示元数据。  
3. 第一版不做鼠标交互，只优化键盘流。  
4. 历史折叠阈值默认 12 行，可后续配置化。

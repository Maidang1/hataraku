# `src/core` Agent SDK 重构方案（2026-02-07）

## 目标

- 把当前 `src/core` 从“CLI 内部实现集合”升级为“可复用 Agent SDK”。
- 明确公共 API 与内部实现边界，避免 UI/CLI 反向耦合到 SDK。
- 支持后续拆包（如 `@coding/agent-sdk`）时最小迁移成本。

## 新目录设计（目标态）

```txt
src/core/
  index.ts                      # SDK 顶层公开 API（唯一稳定入口）

  sdk/                          # 纯 SDK 语义层（不依赖 render/cli）
    agent/
      agent.ts                  # Agent 主类（当前 agent/index.ts 拆分后）
      session.ts                # 会话状态/历史
      events.ts                 # AgentEvents 类型
      tool-loop.ts              # 工具调用循环与响应编排
    runtime/
      context.ts                # ToolExecutionContext / RequestContext
      execution.ts              # 执行器抽象
      errors.ts                 # SDK 级错误模型
    types/
      api.ts                    # SDK 对外类型
      internal.ts               # 内部类型（不从 core/index.ts 导出）

  providers/                    # 模型/平台适配
    anthropic/
      client.ts                 # Anthropic client 工厂
      adapters.ts               # 响应/工具 schema 适配
      types.ts

  tools/
    base/
      tool.ts                   # Tool 抽象基类
      schema.ts
      errors.ts
    registry/
      registry.ts               # Tool 注册、查询、覆盖策略
      presets.ts                # 预置工具集组合
    builtins/
      bash.ts
      file-read.ts
      file-edit.ts
      list-files.ts
      grep.ts
      glob.ts
      fetch.ts
      todo.ts
      architect.ts
      skills.ts
      index.ts
    guards/
      file-edit-cache.ts
      limits.ts

  integrations/
    mcp/
      manager.ts                # 原 connection-manager + 入口聚合
      transport.ts
      cache.ts
      health.ts
      retry.ts
      types.ts
      index.ts
    skills/
      manager.ts
      discovery/
      parsers/
      validation/
      dependency/
      cache/
      config/
      core/
      integration/
      index.ts

  policy/
    safety/
      policy.ts
      types.ts
      index.ts

  observability/
    logging/
      session-logger.ts
      export.ts
      env.ts
      types.ts
      index.ts

  config/
    loader.ts                   # settings 读取 + merge
    schema.ts                   # config 类型定义
    defaults.ts
    index.ts

  shared/                       # 可复用且稳定的无业务工具
    message.ts
    path.ts
    fs.ts

```

## 分层约束

- `sdk/*` 不允许引用 `src/render/*` 或 `src/cli/*`。
- `providers/*` 只能向 `sdk/*`、`tools/base/*` 暴露适配结果。
- `tools/builtins/*` 不直接依赖 UI 状态；UI 注入通过 runtime context 完成。
- `integrations/*` 作为插件式集成层，不反向依赖具体 CLI。

## 现有目录到新目录映射

- `src/core/agent/index.ts` -> `src/core/sdk/agent/agent.ts`（拆分 `events.ts`、`tool-loop.ts`）
- `src/core/client/index.ts` -> `src/core/providers/anthropic/client.ts`
- `src/core/tools/*` -> `src/core/tools/builtins/*` + `src/core/tools/base/*` + `src/core/tools/registry/*`
- `src/core/mcp/*` -> `src/core/integrations/mcp/*`
- `src/core/skills/*` -> `src/core/integrations/skills/*`
- `src/core/safety/*` -> `src/core/policy/safety/*`
- `src/core/logging/*` -> `src/core/observability/logging/*`
- `src/core/config/*` -> `src/core/config/{loader,schema,defaults}.ts`
- `src/core/utils/*` -> `src/core/shared/*`

## 迁移计划（渐进式，避免一次性大改）

1. `Phase 1: 建骨架`
- 新建目标目录与 `index.ts` barrel。

2. `Phase 2: 迁移核心`
- 先迁移 `config`、`logging`、`safety`、`client`（低风险模块）。
- 再迁移 `tools` 与 `mcp`（中风险）。
- 最后迁移 `agent` 主循环与 `skills`（高风险）。

3. `Phase 3: 收敛 API`
- 统一只从 `src/core/index.ts` 导出公共 API。

4. `Phase 4: 清理`
- 删除旧目录壳与过期路径。
- 更新 `docs/agent/architecture.md` 与使用示例。

## 第一批落地建议（本周可做）

- 从 `agent/index.ts` 中移除 `render` 依赖（`setLoading` 通过回调注入）。
- 建立 `tools/registry`，把工具初始化从 Agent 构造函数移出去。
- 抽出 `providers/anthropic/client.ts`，去掉当前 `client/index.ts` 的 `console.log`。
- 增加 `src/core/index.ts` 作为唯一公开入口。

## 风险与控制

- 风险：导入路径大量变动导致编译错误。
- 控制：分模块迁移 + 每一步跑 `bunx tsc -p tsconfig.json --noEmit`。

- 风险：Agent 与 UI 状态耦合导致 SDK 不可复用。
- 控制：将 UI 事件改为 runtime hook（`onLoadingChange`、`onToken` 等）。

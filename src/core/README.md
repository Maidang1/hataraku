# Core 目录定位

`src/core` 采用 SDK 包结构：`api/` 公开稳定接口，`internal/` 放实现细节，不保留旧路径兼容层。

- 重构方案文档：`docs/plan/core-agent-sdk-structure-2026-02-07.md`
- 包入口：`src/core/index.ts`
- 公开 API 入口：`src/core/api/index.ts`

## 当前目录分层

- `api/`：对外稳定导出层（发包后默认面向使用方）
- `internal/sdk/`：Agent SDK 语义实现（agent/runtime/types）
- `internal/providers/`：模型厂商适配（当前含 anthropic）
- `internal/integrations/`：外部系统集成（mcp/skills）
- `internal/tools/`：工具基础设施、内置工具与注册表
- `internal/policy/`：策略层（safety）
- `internal/observability/`：可观测性（logging）
- `internal/config/`：配置加载与 schema
- `internal/shared/`：跨层可复用工具

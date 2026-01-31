# Architectural Decisions - claude-cli-agent

Key technical decisions made during implementation.

---

## Initial Decisions (from planning)
- **Agent Loop**: Use `anthropic.messages.stream()` instead of `toolRunner()` to support confirmation flow
- **Confirmation**: Promise-based blocking confirmation for dangerous tools
- **State Machine**: Simple state pattern (no xstate)
- **TDD**: RED-GREEN-REFACTOR with bun:test
- **Tool Definition**: Using `betaZodTool()` with Zod schemas
- **Session Storage**: JSON files in `~/.claude-cli/sessions/`
- **Edit Semantics**: search-replace (not diff/patch)

---

## Task 1: Tool Types & Interfaces

### ToolResult Type Design
- **Decision**: Use TypeScript discriminated union instead of union of separate types
- **Rationale**: 
  - Automatic type narrowing in handlers: `if (result.success) { result.data }`
  - Compiler prevents accessing `data` when `success: false`
  - Self-documenting: shape reflects intent (success/failure)
- **Alternative Considered**: Generic error wrapper class `{ ok: boolean; value?: T; error?: Error }`
  - Rejected: Less type-safe, requires runtime checks

### DangerLevel as const object (not enum)
- **Decision**: `DangerLevel = { safe: "safe", dangerous: "dangerous" } as const`
- **Rationale**:
  - String literals allow `Object.values(DangerLevel)` to work in tests
  - Plays well with Anthropic SDK's expected string values
  - Can extend to additional levels without enum recompile
- **Alternative Considered**: TypeScript `enum DangerLevel { Safe, Dangerous }`
  - Rejected: Generates extra runtime code, loses string semantics for API compatibility

### Helper Functions (createSafeTool / createDangerousTool)
- **Decision**: Simple wrapper functions that normalize input → output shapes
- **Rationale**:
  - Input uses `inputSchema` (camelCase), output uses `input_schema` (snake_case for Anthropic SDK)
  - Centralized place to add future metadata (e.g., version, permissions)
  - Explicit safety level prevents accidental misclassification
- **Not Used Yet**: Zod schemas deferred to individual tool implementations (read_file, glob, etc.)

### Minimal API Surface
- **Decision**: Export only what tests require; keep module focused
- **Rationale**: Reduces cognitive load, prevents premature abstraction
- **What's NOT exported**:
  - `ToolConfig`, `ToolDefinition` interfaces (internal implementation details)
  - Validation helpers (will be in individual tools)
  - Runtime type checking (rely on TypeScript compiler)

---

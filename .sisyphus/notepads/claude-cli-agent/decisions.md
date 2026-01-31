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

## Task 2: read_file Tool Implementation

### Tool Module Structure Pattern
- **Decision**: Each tool exports `definition` (ToolDefinition) and `toolName()` function separately
- **Rationale**: 
  - Allows agent to reference `definition` for schema without executing function
  - Clear separation between metadata and implementation
  - Supports composition patterns for tool aggregation
- **Pattern**: 
  ```ts
  export const definition = createSafeTool({ ... })
  export async function readFile(input: Input): Promise<ToolResult<string>> { ... }
  ```

### Bun File API vs Node.js fs
- **Decision**: Use `Bun.file()` API instead of `fs` module
- **Rationale**: 
  - Promise-based by default (no callbacks)
  - Better error context from Bun runtime
  - Aligns with project constraint to use Bun APIs
  - `.exists()` check is non-throwing (better than `fs.existsSync()`)
- **Implementation Detail**: Check `.stat().isDirectory()` to reject directory reads

### Error Categorization Strategy
- **Decision**: Differentiate "not found" from "other errors" in error messages
- **Rationale**: 
  - Helps users debug (file path typo vs. permission error)
  - Future: could enable different retry strategies
- **Pattern**: Use specific checks (`.exists()`) before generic try-catch

### Input Validation Responsibility
- **Decision**: Minimal validation in tool function; schema validation deferred
- **Rationale**: 
  - Tool receives input after agent schema validation
  - Defensive: still catch invalid types gracefully
  - Keep tool logic simple and focused
- **Future**: Add Zod schema when validation becomes complex


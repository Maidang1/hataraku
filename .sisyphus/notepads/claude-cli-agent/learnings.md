# Learnings - claude-cli-agent

Conventions, patterns, and wisdom accumulated during implementation.

---

## Task 1: Tool Interface and Types (TDD RED → GREEN)

### Patterns & Conventions

1. **ToolResult Discriminated Union**: Using TypeScript discriminated unions for `ToolResult<T>` provides type-safe error handling:
   - `{ success: true; data: T }` for successful results
   - `{ success: false; error: string }` for failures
   - Optional properties (`data?`, `error?`) ensure compile-time safety

2. **Enum as const object**: Using `as const` on object for DangerLevel creates a literal type union:
   - `DangerLevel.safe` and `DangerLevel.dangerous` are string literals ("safe", "dangerous")
   - Allows `Object.values(DangerLevel)` to work correctly in tests
   - More flexible than traditional TypeScript enums for this use case

3. **Helper Functions Pattern**: `createSafeTool()` and `createDangerousTool()` normalize tool configuration:
   - Input: `{ name, description, inputSchema }`
   - Output: `{ name, description, input_schema, dangerLevel }` (note: snake_case output)
   - Mapping pattern allows input flexibility while standardizing internal structure

4. **Interface Composition**: Separate `ToolConfig` (input) from `ToolDefinition` (output) interfaces:
   - Clear separation of concerns
   - Easier to extend tool features in future tasks (e.g., adding permissions, rate limits)

### Technical Decisions

- **No Zod validation yet**: Tool configuration is simple enough to defer Zod integration to specific tools that use them
- **Minimal exports**: Only export what tests require (ToolResult, DangerLevel, helpers)
- **Type safety over runtime checking**: Rely on TypeScript types rather than runtime assertions

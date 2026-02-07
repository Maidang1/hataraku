# Architecture

## Project Structure

- `src/cli/` - CLI entry layer that renders the Ink app
- `src/render/` - UI layer with Ink components and Jotai state
- `src/core/` - SDK layer (designed for standalone package publishing)
  - `api/` - Stable public exports used by CLI/UI
  - `internal/sdk/` - Agent runtime implementation (agent/runtime/types)
  - `internal/providers/` - LLM provider adapters
  - `internal/tools/` - Tool base/builtins/registry
  - `internal/integrations/` - MCP and skills integrations
  - `internal/config/` - Settings loading and schema
  - `internal/observability/` - Logging and export
  - `internal/policy/` - Safety policy
  - `internal/shared/` - Cross-layer helpers

## Architectural Patterns

- Event-driven agent using EventEmitter to communicate with UI
- Streaming response handling for incremental updates
- Tool abstraction with MCP bridge for extensibility
- Jotai atoms for shared reactive state

## Configuration

- Config files: `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`
- Priority: local > project > user

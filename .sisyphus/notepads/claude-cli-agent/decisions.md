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

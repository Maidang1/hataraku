# claude-cli

A TUI-based coding agent powered by Claude AI, implemented using the Anthropic SDK and Ink framework.

## Features

- **Interactive TUI Interface**: Terminal-based UI built with Ink (React for CLIs)
- **6 Core Tools**: File operations (read, write, edit), code search (glob, grep), and command execution (bash)
- **Safety First**: Dangerous operations (write, edit, bash) require explicit user confirmation
- **Session Persistence**: Save and resume conversations with full message and tool call history
- **Streaming Responses**: Real-time Claude responses with tool use support
- **Test-Driven**: Comprehensive test suite with 132+ tests

## Prerequisites

- [Bun](https://bun.sh) v1.2.22 or later
- Anthropic API key ([get one here](https://console.anthropic.com))

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd claude-cli

# Install dependencies
bun install

# Set up your API key
export ANTHROPIC_API_KEY=your_key_here
```

## Usage

```bash
# Run the CLI
bun run bin/claude-cli

# Or with API key inline
ANTHROPIC_API_KEY=your_key bun run bin/claude-cli
```

### Available Tools

The agent has access to the following tools:

- **read_file**: Read file contents (safe - auto-executes)
- **write_file**: Create or overwrite files (dangerous - requires confirmation)
- **edit_file**: Search-replace text in files (dangerous - requires confirmation)
- **bash**: Execute shell commands (dangerous - requires confirmation)
- **glob**: Find files matching patterns (safe - auto-executes)
- **grep**: Search file contents with regex (safe - auto-executes)

### Session Management

Sessions are automatically saved to `~/.claude-cli/sessions/` as JSON files. Each session includes:
- Message history (user and assistant)
- Tool call records (inputs and results)
- Timestamps (created and updated)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key for Claude access |

## Development

### Project Structure

```
src/
├── core/           # Agent state machine
├── tools/          # Tool implementations (read_file, bash, etc.)
├── session/        # Session persistence
├── ui/             # TUI components (Ink/React)
└── __tests__/      # Test suite
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/__tests__/tools/read_file.test.ts

# Watch mode
bun test --watch
```

### Implementation Status

**Completed** (9/20 tasks):
- ✅ Tool system with safety levels (safe/dangerous)
- ✅ Agent state machine (idle, streaming, awaiting_confirmation, tool_executing, error)
- ✅ All 6 core tools (read_file, write_file, edit_file, bash, glob, grep)
- ✅ Session persistence (save/load/list/delete)

**In Progress**:
- ⏳ Agent core loop with confirmation flow
- ⏳ TUI components (message display, input, status panel)
- ⏳ Full TUI layout integration
- ⏳ CLI entry point

### Testing Philosophy

This project follows Test-Driven Development (TDD):
1. **RED**: Write failing tests first
2. **GREEN**: Implement minimal code to pass tests
3. **REFACTOR**: Clean up while keeping tests green

All tools and core modules have comprehensive test coverage.

### Code Conventions

- Use **Bun APIs** over Node.js equivalents:
  - `Bun.file()` instead of `fs.readFile()`
  - `Bun.write()` instead of `fs.writeFile()`
  - `Bun.spawn()` or `Bun.$` instead of `child_process`
- TypeScript strict mode enabled
- Return `ToolResult<T>` discriminated unions for error handling
- No `console.log` in production code (use TUI components)

## Architecture

### State Machine

The agent operates through a state machine with 5 states:

```
idle → streaming → awaiting_confirmation → tool_executing → idle
                         ↓ (rejection)
                       idle
```

### Confirmation Flow

Dangerous tools trigger a confirmation prompt:
1. Agent detects dangerous tool use (write_file, edit_file, bash)
2. State transitions to `awaiting_confirmation`
3. User presses `y` (confirm) or `n` (reject)
4. If confirmed: execute tool → return to streaming
5. If rejected: send rejection message → return to idle

## Known Issues

- React JSX runtime missing in test environment (1 failing test)
- TUI components not yet integrated (in progress)
- Agent core loop not yet complete (in progress)

See `.sisyphus/notepads/claude-cli-agent/problems.md` for full issue tracking.

## License

MIT License - See [LICENSE](./LICENSE) file for details.

## Contributing

This project is in active development. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

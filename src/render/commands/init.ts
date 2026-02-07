import fs from "fs";
import path from "path";
import type { Agent } from "../../core/api/agent";

export function buildClaudeMdTemplate(params: { projectName: string }): string {
  return `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- \`bun run src/index.ts\` - Run the application
- \`bun --hot src/index.ts\` - Run with hot reload for development
- \`bunx tsc -p tsconfig.json --noEmit\` - Typecheck
- \`bun run test-e2e.ts\` - Run e2e smoke checks

## Project

- Name: ${params.projectName}

## Architecture Overview

- \`src/index.ts\` - Entry
- \`src/cli/\` - CLI bootstrap (Ink render + wiring)
- \`src/render/\` - Ink UI components and Jotai state
- \`src/core/\` - SDK layer (\`api/\` public surface, \`internal/\` implementation)
`;
}

export async function ensureClaudeMd(agent: Agent): Promise<{ ok: boolean; message: string }> {
  const filePath = path.join(process.cwd(), ".claude", "CLAUDE.md");
  if (fs.existsSync(filePath)) {
    return { ok: true, message: "CLAUDE.md already exists." };
  }

  const projectName = path.basename(process.cwd());
  const content = buildClaudeMdTemplate({ projectName });
  const result = await agent.runTool({
    toolName: "fileEdit",
    input: { filePath: ".claude/CLAUDE.md", old_string: "", new_string: content },
    preview: `Write file: .claude/CLAUDE.md (${content.length} chars)`,
  });

  return { ok: !result.content.startsWith("Error:"), message: result.content };
}

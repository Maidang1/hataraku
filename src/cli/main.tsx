import path from "path";
import fs from "fs";
import { render } from "ink";
import { App } from "../render/index";
import { exportSessionToMarkdown } from "../core/api/observability";
import cac, { type CAC } from "cac";

const CONFIG = {
  SESSION_DIR: ".hataraku/sessions",
  DEFAULT_OUTPUT_PATTERN: "session-{id}.md",
  VERSION: "1.0.0",
} as const;

/**
 * Gets the display name for the CLI based on the binary name
 */
function getDisplayName(argv: string[]): string {
  return "hataraku";
}

/**
 * Validates that a session directory exists
 */
function validateSessionDir(sessionDir: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(sessionDir)) {
    return { valid: false, error: `Session not found: ${sessionDir}` };
  }
  return { valid: true };
}

/**
 * Handles the export command
 */
async function handleExportCommand(id: string | undefined, options: { session?: string; out?: string }): Promise<number> {
  const sessionId = id ?? options.session;
  if (!sessionId) {
    console.error("Error: Missing session ID");
    return 1;
  }

  const sessionDir = path.join(process.cwd(), CONFIG.SESSION_DIR, sessionId);
  const validation = validateSessionDir(sessionDir);
  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    return 1;
  }

  const outPath = options.out ?? path.join(process.cwd(), CONFIG.DEFAULT_OUTPUT_PATTERN.replace("{id}", sessionId));

  try {
    exportSessionToMarkdown({ sessionDir, outPath });
    console.log(`✓ Exported: ${outPath}`);
    return 0;
  } catch (error) {
    console.error(`Error exporting session: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Sets up CLI commands and options
 */
function setupCli(cli: CAC): void {
  cli
    .command("export <id>", "Export a session to Markdown")
    .option("--session <id>", "Session ID (deprecated, use positional)")
    .option("--out <path>", "Output markdown path")
    .action(async (id: string, options: { session?: string; out?: string }) => {
      process.exitCode = await handleExportCommand(id, options);
    });

  cli.command("[...args]", "Start TUI").action(() => {
    render(<App />);
  });
}

/**
 * Main entry point for the CLI
 */
export async function main(argv = process.argv): Promise<void> {
  const displayName = getDisplayName(argv);
  const cli = cac(displayName);

  setupCli(cli);
  cli.help();
  cli.version(CONFIG.VERSION);

  try {
    cli.parse(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    cli.outputHelp();
    process.exitCode = 1;
  }
}

// Run the CLI if this file is executed directly
await main();

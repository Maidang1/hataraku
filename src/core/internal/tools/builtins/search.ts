import type Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

export class SearchTool extends Tool {
  name = "search";
  description = "Search in the project using ripgrep (rg). Input: { query, glob? }";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "ripgrep query string" },
          glob: { type: "string", description: "Optional file glob, e.g. '*.ts'" },
        },
        required: ["query"],
      },
    };
  }

  override getPreview(input: { query: string; glob?: string }): string {
    return `Search: ${input.query}${input.glob ? ` (glob: ${input.glob})` : ""}`;
  }

  override execute(
    input: { query: string; glob?: string },
    _context: ToolExecutionContext,
  ): ToolExecutionResult {
    const query = input.query ?? "";
    const glob = input.glob ? `-g "${input.glob}"` : "";
    try {
      const cmd = `rg --line-number --no-heading ${glob} -- ${escapeArg(query)}`;
      const out = execSync(cmd, { encoding: "utf-8", maxBuffer: 1024 * 1024 * 20 });
      return out.trim() || "(no matches)";
    } catch (error: any) {
      const stdout = error?.stdout ? String(error.stdout) : "";
      const stderr = error?.stderr ? String(error.stderr) : "";
      const combined = [stdout, stderr].filter(Boolean).join("\n").trim();
      return combined || `Error: ${error?.message ?? "rg failed"}`;
    }
  }
}

function escapeArg(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/\"/g, '\\"')}"`;
}

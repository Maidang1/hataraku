import type Anthropic from "@anthropic-ai/sdk";
import { spawnSync } from "child_process";
import path from "path";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

export class GlobTool extends Tool {
  name = "glob";
  description = "Find files by glob pattern. Input: { pattern, path? }";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern, e.g. **/*.ts" },
          path: { type: "string", description: "Root path, defaults to cwd" },
        },
        required: ["pattern"],
      },
    };
  }

  override execute(
    input: { pattern: string; path?: string },
    context: ToolExecutionContext,
  ): ToolExecutionResult {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    const target = input.path
      ? path.isAbsolute(input.path)
        ? input.path
        : path.resolve(context.cwd, input.path)
      : context.cwd;

    const result = spawnSync("rg", ["--files", "--glob", input.pattern], {
      cwd: target,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.error) {
      return { isError: true, message: `glob failed: ${result.error.message}` };
    }

    if ((result.status ?? 0) > 1) {
      return {
        isError: true,
        message: result.stderr?.trim() || `glob failed with exit code ${result.status ?? -1}`,
      };
    }

    const files = (result.stdout || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return {
      content: JSON.stringify(
        {
          pattern: input.pattern,
          path: target,
          files,
        },
        null,
        2,
      ),
    };
  }
}

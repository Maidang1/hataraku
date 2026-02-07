import type Anthropic from "@anthropic-ai/sdk";
import { spawnSync } from "child_process";
import path from "path";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

export class GrepTool extends Tool {
  name = "grep";
  description = "Search text in files using ripgrep. Input: { pattern, path?, include? }";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Regex/text pattern" },
          path: { type: "string", description: "Search root path, defaults to cwd" },
          include: { type: "string", description: "Optional include glob like *.ts" },
        },
        required: ["pattern"],
      },
    };
  }

  override execute(
    input: { pattern: string; path?: string; include?: string },
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

    const args = ["--line-number", "--no-heading", input.pattern, target];
    if (input.include) {
      args.unshift("--glob", input.include);
    }

    const result = spawnSync("rg", args, {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });

    if (result.error) {
      return { isError: true, message: `grep failed: ${result.error.message}` };
    }

    const output = result.stdout?.trim() || "";
    const stderr = result.stderr?.trim() || "";

    if (result.status === 0) {
      const matches = output.split("\n").filter(Boolean).map((line) => {
        const parts = line.split(":");
        const filePath = parts.shift() || "";
        const lineNumber = Number(parts.shift() || "0");
        return {
          filePath,
          lineNumber,
          line: parts.join(":"),
        };
      });

      return {
        content: JSON.stringify(
          {
            pattern: input.pattern,
            path: target,
            include: input.include,
            matches,
          },
          null,
          2,
        ),
      };
    }

    if (result.status === 1) {
      return {
        content: JSON.stringify(
          {
            pattern: input.pattern,
            path: target,
            include: input.include,
            matches: [],
          },
          null,
          2,
        ),
      };
    }

    return {
      isError: true,
      message: stderr || `grep failed with exit code ${result.status ?? -1}`,
    };
  }
}

import type Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

export class ListFilesTool extends Tool {
  name = "listFiles";
  description = "List files and directories. Input: { path? }";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path, defaults to cwd" },
        },
      },
    };
  }

  override execute(
    input: { path?: string },
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

    try {
      const entries = fs.readdirSync(target, { withFileTypes: true })
        .map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? "dir" : "file",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        content: JSON.stringify(
          {
            path: target,
            entries,
            total: entries.length,
          },
          null,
          2,
        ),
      };
    } catch (error) {
      return {
        isError: true,
        message: `List files failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

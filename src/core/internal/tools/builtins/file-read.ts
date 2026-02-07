import type Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { Tool, type ToolExecutionResult, type ToolExecutionContext } from "../base";
import { limitText } from "../guards/limits";
import { noteFileReadForEdit } from "../guards/file-edit-cache";

export class FileReadTool extends Tool {
  name = "fileRead";
  description = "Read a text file. Input: { filePath, offset?, limit? }";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Absolute or cwd-relative file path" },
          offset: { type: "number", description: "Line offset (0-based)" },
          limit: { type: "number", description: "Max lines to read" },
        },
        required: ["filePath"],
      },
    };
  }

  override execute(
    input: { filePath: string; offset?: number; limit?: number },
    context: ToolExecutionContext,
  ): ToolExecutionResult {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    const filePath = path.isAbsolute(input.filePath)
      ? input.filePath
      : path.resolve(context.cwd, input.filePath);

    try {
      if (!fs.existsSync(filePath)) {
        return { isError: true, message: `File not found: ${filePath}` };
      }
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return { isError: true, message: `Path is not a file: ${filePath}` };
      }

      const raw = fs.readFileSync(filePath, "utf8");
      noteFileReadForEdit(filePath, raw);

      const maxLines = typeof input.limit === "number" ? Math.min(2000, input.limit) : 2000;
      const limited = limitText(raw, {
        offset: input.offset ?? 0,
        maxLines,
      });

      const payload = {
        filePath,
        content: limited.content,
        offset: limited.actualOffset,
        limit: limited.actualLimit,
        fileTotalLines: limited.fileTotalLines,
      };

      return { content: JSON.stringify(payload, null, 2) };
    } catch (error) {
      return {
        isError: true,
        message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

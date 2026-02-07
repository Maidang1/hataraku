import type Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";
import { hasMatchingReadContext, noteFileReadForEdit } from "../guards/file-edit-cache";

function checkStringMatch(content: string, substring: string): "none" | "one" | "more" {
  if (substring === "") return content.length === 0 ? "none" : "more";
  const firstIndex = content.indexOf(substring);
  if (firstIndex === -1) return "none";
  const secondIndex = content.indexOf(substring, firstIndex + 1);
  return secondIndex === -1 ? "one" : "more";
}

function calculateStartLineNumber(content: string, searchText: string): number {
  const lines = content.split("\n");
  const searchLines = searchText.split("\n");

  for (let i = 0; i <= lines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (lines[i + j] !== searchLines[j]) {
        match = false;
        break;
      }
    }
    if (match) return i + 1;
  }

  return 1;
}

export class FileEditTool extends Tool {
  name = "fileEdit";
  description = "Edit one file by replacing old_string with new_string. Input: { filePath, old_string, new_string }";
  readonly = false;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Absolute or cwd-relative file path" },
          old_string: { type: "string", description: "Unique old text to replace" },
          new_string: { type: "string", description: "New text" },
        },
        required: ["filePath", "old_string", "new_string"],
      },
    };
  }

  override execute(
    input: { filePath: string; old_string: string; new_string: string },
    context: ToolExecutionContext,
  ): ToolExecutionResult {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    const filePath = path.isAbsolute(input.filePath)
      ? input.filePath
      : path.resolve(context.cwd, input.filePath);

    try {
      const exists = fs.existsSync(filePath);

      if (!exists && input.old_string !== "") {
        return { isError: true, message: "File not found" };
      }

      if (!exists && input.old_string === "") {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, input.new_string, "utf8");
        noteFileReadForEdit(filePath, input.new_string);
        return {
          content: JSON.stringify(
            {
              filePath,
              mode: "create",
              success: true,
              editStartLine: 1,
            },
            null,
            2,
          ),
          filesChanged: [path.relative(context.cwd, filePath)],
        };
      }

      const before = fs.readFileSync(filePath, "utf8");
      if (!hasMatchingReadContext(filePath, before)) {
        return { isError: true, message: "Please read the file first to confirm context." };
      }

      const match = checkStringMatch(before, input.old_string);
      if (match === "none") {
        return { isError: true, message: "old_string not found" };
      }
      if (match === "more") {
        return { isError: true, message: "old_string is not unique" };
      }

      if (context.signal?.aborted) {
        return { isError: true, isAborted: true, message: "Aborted" };
      }

      const editStartLine = calculateStartLineNumber(before, input.old_string);
      const after = before.replace(input.old_string, input.new_string);
      fs.writeFileSync(filePath, after, "utf8");
      noteFileReadForEdit(filePath, after);

      return {
        content: JSON.stringify(
          {
            filePath,
            mode: "update",
            success: true,
            editStartLine,
          },
          null,
          2,
        ),
        filesChanged: [path.relative(context.cwd, filePath)],
      };
    } catch (error) {
      return {
        isError: true,
        message: `File edit failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

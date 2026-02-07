import type Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

function safeResolve(projectRoot: string, targetPath: string): string {
  if (!targetPath) return projectRoot;
  if (path.isAbsolute(targetPath)) return path.resolve(targetPath);
  return path.resolve(projectRoot, targetPath);
}

export class FsReadTool extends Tool {
  name = "fs_read";
  description = "Read a text file from the project. Input: { path }";
  readonly = true;

  constructor(private params: { projectRoot: string }) {
    super();
  }

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: { path: { type: "string", description: "Path relative to project root" } },
        required: ["path"],
      },
    };
  }

  override getPreview(input: { path: string }): string {
    return `Read file: ${input.path}`;
  }

  override execute(
    input: { path: string },
    _context: ToolExecutionContext,
  ): ToolExecutionResult {
    const filePath = safeResolve(this.params.projectRoot, input.path);
    const content = fs.readFileSync(filePath, "utf-8");
    return content;
  }
}

export class FsWriteTool extends Tool {
  name = "fs_write";
  description = "Write a text file in the project. Input: { path, content }";
  readonly = false;

  constructor(private params: { projectRoot: string }) {
    super();
  }

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relative to project root" },
          content: { type: "string", description: "Full new file contents" },
        },
        required: ["path", "content"],
      },
    };
  }

  override getPreview(input: { path: string; content: string }): string {
    const size = input.content?.length ?? 0;
    const head = (input.content ?? "").slice(0, 200);
    return `Write file: ${input.path} (${size} chars)\n---\n${head}${size > 200 ? "\n..." : ""}`;
  }

  override execute(
    input: { path: string; content: string },
    _context: ToolExecutionContext,
  ): ToolExecutionResult {
    const filePath = safeResolve(this.params.projectRoot, input.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, input.content ?? "", "utf-8");
    return { content: `Wrote ${input.path}`, filesChanged: [input.path] };
  }
}

type ParsedFilePatch = {
  filePath: string;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: string[];
  }>;
};

function parseUnifiedDiff(patch: string): ParsedFilePatch[] {
  const files: ParsedFilePatch[] = [];
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.startsWith("--- ")) {
      i++;
      continue;
    }
    const oldFile = line.slice(4).trim();
    const next = lines[i + 1] ?? "";
    if (!next.startsWith("+++ ")) {
      i++;
      continue;
    }
    const newFile = next.slice(4).trim();
    const filePath = stripDiffPrefix(newFile) || stripDiffPrefix(oldFile);
    const file: ParsedFilePatch = { filePath, hunks: [] };
    i += 2;

    while (i < lines.length) {
      const h = lines[i] ?? "";
      if (h.startsWith("--- ")) break;
      if (!h.startsWith("@@")) {
        i++;
        continue;
      }
      const match = /^@@\s+\-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(h);
      if (!match) {
        i++;
        continue;
      }
      const oldStart = Number(match[1]);
      const oldLines = Number(match[2] ?? "1");
      const newStart = Number(match[3]);
      const newLines = Number(match[4] ?? "1");
      i++;
      const hunkLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i] ?? "";
        if (l.startsWith("@@") || l.startsWith("--- ")) break;
        if (l.startsWith("\\ No newline at end of file")) {
          i++;
          continue;
        }
        hunkLines.push(l);
        i++;
      }
      file.hunks.push({ oldStart, oldLines, newStart, newLines, lines: hunkLines });
    }

    files.push(file);
  }

  return files;
}

function stripDiffPrefix(file: string): string {
  const trimmed = file.trim();
  if (trimmed === "/dev/null") return "";
  return trimmed.replace(/^a\//, "").replace(/^b\//, "");
}

function applyUnifiedDiffToText(originalText: string, filePatch: ParsedFilePatch): string {
  const originalLines = originalText.replace(/\r\n/g, "\n").split("\n");
  let output: string[] = [];
  let cursor = 0;

  for (const hunk of filePatch.hunks) {
    const hunkOldIndex = Math.max(0, hunk.oldStart - 1);
    if (hunkOldIndex < cursor) {
      throw new Error(`Overlapping hunk at ${filePatch.filePath}`);
    }
    output = output.concat(originalLines.slice(cursor, hunkOldIndex));
    cursor = hunkOldIndex;

    for (const line of hunk.lines) {
      const op = line[0];
      const payload = line.slice(1);
      if (op === " ") {
        const current = originalLines[cursor] ?? "";
        if (current !== payload) {
          throw new Error(`Context mismatch in ${filePatch.filePath} at line ${cursor + 1}`);
        }
        output.push(payload);
        cursor++;
      } else if (op === "-") {
        const current = originalLines[cursor] ?? "";
        if (current !== payload) {
          throw new Error(`Delete mismatch in ${filePatch.filePath} at line ${cursor + 1}`);
        }
        cursor++;
      } else if (op === "+") {
        output.push(payload);
      } else if (op === "") {
        output.push("");
      } else {
        throw new Error(`Unsupported diff line: "${line}"`);
      }
    }
  }

  output = output.concat(originalLines.slice(cursor));
  return output.join("\n");
}

export class FsPatchTool extends Tool {
  name = "fs_patch";
  description =
    "Apply a unified diff patch to one or more files in the project. Input: { patch } (unified diff)";
  readonly = false;

  constructor(private params: { projectRoot: string }) {
    super();
  }

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: { patch: { type: "string", description: "Unified diff patch" } },
        required: ["patch"],
      },
    };
  }

  override getPreview(input: { patch: string }): string {
    return `Apply patch (unified diff), ${input.patch?.length ?? 0} chars`;
  }

  override execute(
    input: { patch: string },
    _context: ToolExecutionContext,
  ): ToolExecutionResult {
    const patches = parseUnifiedDiff(input.patch ?? "");
    if (!patches.length) return { content: "No changes (empty/invalid diff)" };

    const changed: string[] = [];
    for (const filePatch of patches) {
      const relPath = filePatch.filePath;
      if (!relPath) continue;
      const absPath = safeResolve(this.params.projectRoot, relPath);
      const original = fs.existsSync(absPath) ? fs.readFileSync(absPath, "utf-8") : "";
      const updated = applyUnifiedDiffToText(original, filePatch);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, updated, "utf-8");
      changed.push(relPath);
    }

    return { content: `Patched ${changed.length} file(s)`, filesChanged: changed };
  }
}

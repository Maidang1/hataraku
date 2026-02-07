import fs from "fs";
import path from "path";
import type { ExportOptions } from "./types";

function readFileIfExists(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

export function exportSessionToMarkdown(options: ExportOptions): void {
  const sessionDir = options.sessionDir;
  const sessionJsonl = readFileIfExists(path.join(sessionDir, "session.jsonl"));
  const envJson = readFileIfExists(path.join(sessionDir, "env.json"));
  const changesJson = readFileIfExists(path.join(sessionDir, "changes.json"));

  const lines: string[] = [];
  lines.push("# Coding Agent Session Export");
  lines.push("");
  lines.push(`- Session dir: ${sessionDir}`);
  lines.push("");

  if (envJson) {
    lines.push("## Environment");
    lines.push("");
    lines.push("```json");
    lines.push(envJson.trim());
    lines.push("```");
    lines.push("");
  }

  if (changesJson) {
    lines.push("## Changes");
    lines.push("");
    lines.push("```json");
    lines.push(changesJson.trim());
    lines.push("```");
    lines.push("");
  }

  if (sessionJsonl) {
    lines.push("## Session Log (JSONL)");
    lines.push("");
    lines.push("```jsonl");
    lines.push(sessionJsonl.trim());
    lines.push("```");
    lines.push("");
  }

  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, lines.join("\n"), "utf-8");
}

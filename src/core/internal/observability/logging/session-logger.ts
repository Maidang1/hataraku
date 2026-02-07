import fs from "fs";
import path from "path";
import type { SessionEvent } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export class SessionLogger {
  readonly sessionId: string;
  readonly projectRoot: string;
  readonly sessionDir: string;
  private sessionLogPath: string;

  constructor(params: { sessionId: string; projectRoot: string; baseDir?: string }) {
    this.sessionId = params.sessionId;
    this.projectRoot = params.projectRoot;
    const baseDir = params.baseDir ?? path.join(this.projectRoot, ".coding-agent", "sessions");
    this.sessionDir = path.join(baseDir, this.sessionId);
    fs.mkdirSync(this.sessionDir, { recursive: true });
    this.sessionLogPath = path.join(this.sessionDir, "session.jsonl");
    this.append({
      type: "session_start",
      ts: nowIso(),
      sessionId: this.sessionId,
      projectRoot: this.projectRoot,
    });
  }

  append(event: SessionEvent): void {
    fs.appendFileSync(this.sessionLogPath, JSON.stringify(event) + "\n", "utf-8");
  }

  writeJson(fileName: string, data: unknown): void {
    const filePath = path.join(this.sessionDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  recordFilesChanged(files: string[]): void {
    const filePath = path.join(this.sessionDir, "changes.json");
    const existing = readJson<{ files: string[] }>(filePath) ?? { files: [] };
    const merged = new Set([...existing.files, ...files]);
    fs.writeFileSync(filePath, JSON.stringify({ files: Array.from(merged).sort() }, null, 2), "utf-8");
  }
}

function readJson<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

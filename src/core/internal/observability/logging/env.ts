import os from "os";
import { execSync } from "child_process";
import type { EnvSnapshot } from "./types";

function tryExec(command: string): string | undefined {
  try {
    return execSync(command, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

export function collectEnvSnapshot(projectRoot: string): EnvSnapshot {
  const branch = tryExec(`git -C "${projectRoot}" rev-parse --abbrev-ref HEAD`);
  const status = tryExec(`git -C "${projectRoot}" status --porcelain=v1 -b`);
  return {
    ts: new Date().toISOString(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus()?.length ?? 0,
    },
    runtime: {
      bunVersion: (globalThis as any).Bun?.version,
      nodeVersion: process.version,
    },
    shell: process.env.SHELL,
    cwd: process.cwd(),
    git: { branch, status },
  };
}

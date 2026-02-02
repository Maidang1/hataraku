import fs from "fs";
import path from "path";
import os from "os";

export type ClaudeSettings = {
  env?: Record<string, string>;
  model?: string;
  apiKeyHelper?: string;
  mcpServers?: Record<string, McpServerConfig>;
};

export type McpServerConfig = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
};

export type EffectiveConfig = {
  model: string;
  baseURL?: string;
  authToken?: string;
  apiKey?: string;
  mcpServers: Record<string, McpServerConfig>;
  sources: string[];
};

let cachedConfig: EffectiveConfig | null = null;

function readSettingsFile(filePath: string): ClaudeSettings | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ClaudeSettings;
  } catch (error) {
    console.warn(`Failed to read settings file: ${filePath}`, error);
    return null;
  }
}

function mergeSettings(base: ClaudeSettings, next: ClaudeSettings): ClaudeSettings {
  return {
    ...base,
    ...next,
    env: {
      ...(base.env ?? {}),
      ...(next.env ?? {})
    },
    mcpServers: {
      ...(base.mcpServers ?? {}),
      ...(next.mcpServers ?? {})
    },
  };
}

function getSettingsPaths(cwd: string): string[] {
  const userSettings = path.join(os.homedir(), ".claude", "settings.json");
  const projectSettings = path.join(cwd, ".claude", "settings.json");
  const localSettings = path.join(cwd, ".claude", "settings.local.json");
  return [userSettings, projectSettings, localSettings];
}

function loadClaudeSettings(cwd: string): { settings: ClaudeSettings; sources: string[] } {
  const paths = getSettingsPaths(cwd);
  let merged: ClaudeSettings = {};
  const sources: string[] = [];

  for (const filePath of paths) {
    const settings = readSettingsFile(filePath);
    if (settings) {
      merged = mergeSettings(merged, settings);
      sources.push(filePath);
    }
  }

  return { settings: merged, sources };
}

function applyEnvFromSettings(settings: ClaudeSettings): void {
  const env = settings.env;
  if (!env) return;

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getEffectiveConfig(): EffectiveConfig {
  if (cachedConfig) return cachedConfig;

  const cwd = process.cwd();
  const { settings, sources } = loadClaudeSettings(cwd);
  applyEnvFromSettings(settings);

  const model = process.env.ANTHROPIC_MODEL ?? settings.model ?? "ark-code-latest";
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mcpServers = settings.mcpServers ?? {};

  cachedConfig = { model, baseURL, authToken, apiKey, mcpServers, sources };
  return cachedConfig;
}

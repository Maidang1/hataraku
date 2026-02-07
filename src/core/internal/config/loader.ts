import fs from "fs";
import path from "path";
import os from "os";
import { DEFAULT_MODEL, resolveContextSettings } from "./defaults";
import type { ClaudeSettings, EffectiveConfig } from "./schema";

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
      ...(next.env ?? {}),
    },
    mcpServers: {
      ...(base.mcpServers ?? {}),
      ...(next.mcpServers ?? {}),
    },
    context: {
      ...(base.context ?? {}),
      ...(next.context ?? {}),
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

export function resetEffectiveConfigCache(): void {
  cachedConfig = null;
}

export function getEffectiveConfig(): EffectiveConfig {
  if (cachedConfig) return cachedConfig;

  const cwd = process.cwd();
  const { settings, sources } = loadClaudeSettings(cwd);
  applyEnvFromSettings(settings);

  const model = process.env.ANTHROPIC_MODEL ?? settings.model ?? DEFAULT_MODEL;
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mcpServers = settings.mcpServers ?? {};

  cachedConfig = {
    model,
    baseURL,
    authToken,
    apiKey,
    mcpServers,
    context: resolveContextSettings(model, settings.context),
    safety: settings.safety,
    logging: settings.logging,
    sources,
  };
  return cachedConfig;
}

/**
 * Save settings to the project-local .claude/settings.json file.
 * Creates the file and directory if they don't exist.
 */
export function saveConfig(settings: ClaudeSettings): void {
  const cwd = process.cwd();
  const projectSettingsPath = path.join(cwd, ".claude", "settings.json");

  // Ensure .claude directory exists
  const claudeDir = path.join(cwd, ".claude");
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true, mode: 0o755 });
  }

  // Read existing settings to merge
  const existingSettings = readSettingsFile(projectSettingsPath) ?? {};
  const mergedSettings = mergeSettings(existingSettings, settings);

  // Write merged settings
  fs.writeFileSync(projectSettingsPath, JSON.stringify(mergedSettings, null, 2), "utf-8");

  // Reset cache so next getEffectiveConfig will reload
  resetEffectiveConfigCache();
}

/**
 * Add a tool name to the auto-allowed tools list in the project config.
 */
export function addAutoAllowedTool(toolName: string): void {
  const cwd = process.cwd();
  const { settings } = loadClaudeSettings(cwd);

  const autoAllowedTools = settings.safety?.autoAllowedTools ?? [];
  if (!autoAllowedTools.includes(toolName)) {
    const newAutoAllowedTools = [...autoAllowedTools, toolName];
    const updatedSettings: ClaudeSettings = {
      safety: {
        ...settings.safety,
        autoAllowedTools: newAutoAllowedTools,
        // Preserve other safety settings
        allowedWriteRoots: settings.safety?.allowedWriteRoots,
        autoAllowedBashPrefixes: settings.safety?.autoAllowedBashPrefixes,
      },
    };
    saveConfig(updatedSettings);
  }
}

import type { ClaudeSettings, ContextSettings } from "./schema";

export const DEFAULT_MODEL = "ark-code-latest";
export const DEFAULT_MODEL_CONTEXT_WINDOW_TOKENS = 200_000;
export const DEFAULT_AUTO_COMPACT_RATIO = 0.8;

export type ResolvedContextSettings = {
  modelContextWindowTokens: number;
  modelAutoCompactTokenLimit: number;
  compactPrompt: string;
  compactMaxOutputTokens: number;
  recentMessagesToKeep: number;
  targetPostCompactRatio: number;
  enableAutoCompact: boolean;
};

const DEFAULT_COMPACT_PROMPT = [
  "Summarize the earlier conversation for a coding agent so it can continue work with less context.",
  "Preserve concrete technical details and avoid fluff.",
  "Output plain text with these sections:",
  "1) Goal",
  "2) Decisions Made",
  "3) Work Completed",
  "4) Pending Work",
  "5) Important Constraints",
  "6) Key Files/Commands",
  "7) Open Risks/Questions",
].join("\n");

export const DEFAULT_SETTINGS: ClaudeSettings = {
  env: {},
  mcpServers: {},
};

export function getDefaultModelContextWindowTokens(model: string): number {
  const lower = model.toLowerCase();
  if (lower.includes("haiku")) return 200_000;
  if (lower.includes("sonnet")) return 200_000;
  if (lower.includes("opus")) return 200_000;
  return DEFAULT_MODEL_CONTEXT_WINDOW_TOKENS;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function resolveContextSettings(
  model: string,
  context?: ContextSettings,
): ResolvedContextSettings {
  const modelContextWindowTokens = clampInt(
    context?.modelContextWindowTokens ?? getDefaultModelContextWindowTokens(model),
    8_192,
    1_000_000,
  );
  const modelAutoCompactTokenLimit = clampInt(
    context?.modelAutoCompactTokenLimit ?? modelContextWindowTokens * DEFAULT_AUTO_COMPACT_RATIO,
    4_096,
    modelContextWindowTokens,
  );

  return {
    modelContextWindowTokens,
    modelAutoCompactTokenLimit,
    compactPrompt: context?.compactPrompt?.trim() || DEFAULT_COMPACT_PROMPT,
    compactMaxOutputTokens: clampInt(context?.compactMaxOutputTokens ?? 1024, 256, 8_192),
    recentMessagesToKeep: clampInt(context?.recentMessagesToKeep ?? 12, 2, 100),
    targetPostCompactRatio: Math.min(0.95, Math.max(0.2, context?.targetPostCompactRatio ?? 0.6)),
    enableAutoCompact: context?.enableAutoCompact ?? true,
  };
}

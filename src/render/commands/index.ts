import type { Agent } from "../../core/api/agent";
import { getEffectiveConfig } from "../../core/api/config";
import { addChatEvent, clearEvents } from "../state/events";
import { ensureClaudeMd } from "./init";

export type SlashCommandContext = {
  agent: Agent;
  setModelLabel: (model: string) => void;
  setShowWelcome: (value: boolean) => void;
  setTokenUsage: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
};

export type SlashCommandMeta = {
  name: string;
  description: string;
  usage?: string;
};

type SlashCommandHandler = (ctx: SlashCommandContext, args: string[]) => Promise<void> | void;

export const SLASH_COMMANDS: SlashCommandMeta[] = [
  {
    name: "help",
    description: "show this message",
  },
  {
    name: "clear",
    description: "clear conversation",
  },
  {
    name: "model",
    description: "switch model",
    usage: "<name>",
  },
  {
    name: "session",
    description: "show session info",
  },
  {
    name: "compact",
    description: "compact context now",
  },
  {
    name: "context",
    description: "show context budget and usage",
  },
  {
    name: "init",
    description: "create CLAUDE.md",
  },
];

const HELP_TEXT = [
  "Shortcuts:",
  "- Esc: toggle expand last tool result",
  "- Shift+Tab: toggle thinking mode",
  "- Up/Down: input history",
  "- Confirm: Up/Down select, Enter confirm, Esc deny",
  "",
  "Commands:",
  ...SLASH_COMMANDS.map((cmd) => `- /${cmd.name}${cmd.usage ? ` ${cmd.usage}` : ""} — ${cmd.description}`),
].join("\n");

const handlers: Record<string, SlashCommandHandler> = {
  help: () => {
    addChatEvent({ role: "system", content: HELP_TEXT });
  },
  clear: (ctx) => {
    ctx.agent.resetConversation();
    clearEvents();
    ctx.setTokenUsage({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    ctx.setShowWelcome(true);
    addChatEvent({ role: "system", content: "Conversation and model context cleared." });
  },
  model: (ctx, args) => {
    const next = args.join(" ").trim();
    if (!next) {
      addChatEvent({ role: "system", content: `Current model: ${ctx.agent.model}` });
      return;
    }
    ctx.agent.model = next;
    ctx.setModelLabel(next);
    addChatEvent({ role: "system", content: `Switched model to: ${next}` });
  },
  session: (ctx) => {
    const config = getEffectiveConfig();
    const sources = config.sources.length ? config.sources.join("\n- ") : "(none)";
    const mcpCount = Object.keys(config.mcpServers ?? {}).length;
    addChatEvent({
      role: "system",
      content: [
        `sessionId: ${ctx.agent.sessionId}`,
        `model: ${ctx.agent.model}`,
        `mcpServers: ${mcpCount}`,
        `config sources:\n- ${sources}`,
      ].join("\n"),
    });
  },
  compact: async (ctx) => {
    const result = await ctx.agent.compactNow({ reason: "manual" });
    if (!result.compacted) {
      addChatEvent({
        role: "system",
        content: `No compaction performed (tokens ${result.beforeTokens} -> ${result.afterTokens}).`,
      });
      return;
    }
    addChatEvent({
      role: "system",
      content: [
        `Context compacted: ${result.beforeTokens} -> ${result.afterTokens} tokens`,
        `Estimated counts: before=${result.estimatedBeforeTokens}, after=${result.estimatedAfterTokens}`,
      ].join("\n"),
    });
  },
  context: async (ctx) => {
    const state = await ctx.agent.getContextState();
    addChatEvent({
      role: "system",
      content: [
        `context window: ${state.modelContextWindowTokens}`,
        `auto compact limit: ${state.modelAutoCompactTokenLimit}`,
        `auto compact enabled: ${state.enableAutoCompact}`,
        `current input tokens: ${state.currentInputTokens}${state.tokenCountEstimated ? " (estimated)" : ""}`,
        `history messages: ${state.historyMessages}`,
        `compactions: ${state.compactionCount}`,
        `last compaction: ${state.lastCompactionAt ?? "(none)"}`,
      ].join("\n"),
    });
  },
  init: async (ctx) => {
    const result = await ensureClaudeMd(ctx.agent);
    addChatEvent({ role: "system", content: result.message });
  },
};

export function parseSlashCommand(input: string): { name: string; args: string[] } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  const rest = trimmed.slice(1).trim();
  if (!rest) return { name: "help", args: [] };
  const parts = rest.split(/\s+/);
  const name = (parts.shift() ?? "").toLowerCase();
  return { name, args: parts };
}

export async function runSlashCommand(ctx: SlashCommandContext, input: string): Promise<boolean> {
  const parsed = parseSlashCommand(input);
  if (!parsed) return false;
  const handler = handlers[parsed.name];
  if (!handler) {
    addChatEvent({ role: "system", content: `Unknown command: /${parsed.name}. Try /help.` });
    return true;
  }
  await handler(ctx, parsed.args);
  return true;
}

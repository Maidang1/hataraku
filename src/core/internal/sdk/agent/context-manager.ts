import Anthropic from "@anthropic-ai/sdk";
import type { ResolvedContextSettings } from "../../config/defaults";

export type TokenCountResult = {
  inputTokens: number;
  estimated: boolean;
};

export type CompactResult = {
  summary: string;
  removedMessageCount: number;
  summaryMessage: Anthropic.MessageParam;
  preservedTail: Anthropic.MessageParam[];
};

const TRANSCRIPT_CHAR_LIMIT = 120_000;

export class ContextManager {
  private client: Anthropic;
  private model: string;
  private getSystemPrompt: () => string;
  private getToolSchemas: () => Anthropic.Tool[];
  private getThinking: () => Anthropic.ThinkingConfigParam | undefined;
  private settings: ResolvedContextSettings;

  constructor(params: {
    client: Anthropic;
    model: string;
    getSystemPrompt: () => string;
    getToolSchemas: () => Anthropic.Tool[];
    getThinking: () => Anthropic.ThinkingConfigParam | undefined;
    settings: ResolvedContextSettings;
  }) {
    this.client = params.client;
    this.model = params.model;
    this.getSystemPrompt = params.getSystemPrompt;
    this.getToolSchemas = params.getToolSchemas;
    this.getThinking = params.getThinking;
    this.settings = params.settings;
  }

  updateModel(model: string): void {
    this.model = model;
  }

  async countTokens(messages: Anthropic.MessageParam[]): Promise<TokenCountResult> {
    try {
      const response = await this.client.messages.countTokens({
        model: this.model,
        messages,
        system: this.getSystemPrompt(),
        tools: this.getToolSchemas(),
        thinking: this.getThinking(),
      });
      return { inputTokens: response.input_tokens, estimated: false };
    } catch {
      return { inputTokens: this.estimateTokens(messages), estimated: true };
    }
  }

  shouldCompact(inputTokens: number): boolean {
    if (!this.settings.enableAutoCompact) return false;
    return inputTokens >= this.settings.modelAutoCompactTokenLimit;
  }

  async compactHistory(
    history: Anthropic.MessageParam[],
    params: { reason: string; keepRecentMessages?: number },
  ): Promise<CompactResult | null> {
    const keepRecentMessages = params.keepRecentMessages ?? this.settings.recentMessagesToKeep;
    const splitIndex = this.selectCompactionBoundary(history, keepRecentMessages);
    if (splitIndex <= 0 || splitIndex >= history.length) {
      return null;
    }

    const oldHistory = history.slice(0, splitIndex);
    const preservedTail = history.slice(splitIndex);
    const summary = await this.generateSummary(oldHistory, params.reason);
    const summaryMessage = this.buildSummaryMessage(summary, params.reason);

    return {
      summary,
      removedMessageCount: oldHistory.length,
      summaryMessage,
      preservedTail,
    };
  }

  getSettings(): ResolvedContextSettings {
    return this.settings;
  }

  private estimateTokens(messages: Anthropic.MessageParam[]): number {
    const payloadChars =
      JSON.stringify(messages).length +
      this.getSystemPrompt().length +
      JSON.stringify(this.getToolSchemas()).length;
    return Math.ceil(payloadChars / 4);
  }

  private selectCompactionBoundary(messages: Anthropic.MessageParam[], keepRecent: number): number {
    const minKeep = Math.max(2, keepRecent);
    if (messages.length <= minKeep + 1) return 0;

    let index = messages.length - minKeep;
    if (index <= 0) return 0;

    // Keep tool-use and tool-result turns together as much as possible.
    while (index > 1) {
      const current = messages[index];
      if (!current) break;
      if (this.hasToolResult(current)) {
        index -= 1;
        continue;
      }
      break;
    }

    return index;
  }

  private hasToolResult(message: Anthropic.MessageParam): boolean {
    if (!Array.isArray(message.content)) return false;
    return message.content.some((block) => {
      if (typeof block === "string") return false;
      return block.type === "tool_result";
    });
  }

  private buildSummaryMessage(summary: string, reason: string): Anthropic.MessageParam {
    const content = [
      `[Context Summary | reason=${reason}]`,
      summary.trim(),
    ].join("\n");
    return { role: "assistant", content };
  }

  private async generateSummary(messages: Anthropic.MessageParam[], reason: string): Promise<string> {
    const transcript = this.serializeMessages(messages);
    const prompt = [
      this.settings.compactPrompt,
      "",
      `Compaction reason: ${reason}`,
      "",
      "Conversation transcript:",
      transcript,
    ].join("\n");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.settings.compactMaxOutputTokens,
      stream: false,
      tools: [],
      messages: [{ role: "user", content: prompt }],
      system: "You produce concise, loss-minimizing technical summaries for context compaction.",
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    if (!text) {
      return "Conversation was compacted due to context window limits. Continue using recent turns as source of truth.";
    }

    return text;
  }

  private serializeMessages(messages: Anthropic.MessageParam[]): string {
    const lines: string[] = [];
    for (const message of messages) {
      lines.push(`${message.role.toUpperCase()}:`);
      lines.push(this.stringifyContent(message.content));
      lines.push("");
    }
    const joined = lines.join("\n").trim();
    if (joined.length <= TRANSCRIPT_CHAR_LIMIT) return joined;
    return joined.slice(joined.length - TRANSCRIPT_CHAR_LIMIT);
  }

  private stringifyContent(content: Anthropic.MessageParam["content"]): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block.type === "text") return block.text;
        if (block.type === "tool_use") {
          return `[tool_use:${block.name}] ${JSON.stringify(block.input)}`;
        }
        if (block.type === "tool_result") {
          const payload =
            typeof block.content === "string" ? block.content : JSON.stringify(block.content);
          return `[tool_result:${block.tool_use_id}] ${payload}`;
        }
        if (block.type === "thinking") return "[thinking omitted]";
        if (block.type === "redacted_thinking") return "[redacted_thinking]";
        return JSON.stringify(block);
      })
      .join("\n");
  }
}

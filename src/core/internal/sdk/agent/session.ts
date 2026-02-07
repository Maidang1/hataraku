import type Anthropic from "@anthropic-ai/sdk";

export type AgentConversationHistory = Anthropic.MessageParam[];

export type AgentSessionState = {
  sessionId: string;
  projectRoot: string;
  conversationHistory: AgentConversationHistory;
};

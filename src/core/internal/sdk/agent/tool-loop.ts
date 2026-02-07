import type Anthropic from "@anthropic-ai/sdk";

export type ToolLoopRequest = {
  history: Anthropic.MessageParam[];
};

export type ToolLoopResult = {
  history: Anthropic.MessageParam[];
  toolCalls: number;
};

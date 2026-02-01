import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export function createUserMessage(content: string): MessageParam {
  return {
    role: "user",
    content,
  };
}

export function createUserMessages(contents: string[]): MessageParam[] {
  return contents.map(createUserMessage);
}

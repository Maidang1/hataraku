import type Anthropic from "@anthropic-ai/sdk";

export abstract class Tool {
  abstract name: string;
  abstract description: string;

  abstract getSchema(): Anthropic.Tool;
  abstract execute(input: any): Promise<string> | string;
}

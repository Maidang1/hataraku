import type Anthropic from "@anthropic-ai/sdk";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

export class FetchTool extends Tool {
  name = "fetch";
  description = "Fetch URL content. Input: { url }";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string", description: "HTTP/HTTPS URL" },
        },
        required: ["url"],
      },
    };
  }

  override async execute(
    input: { url: string },
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    try {
      const res = await fetch(input.url, {
        signal: context.signal,
      });

      const mimeType = res.headers.get("content-type") || "";
      const content = await res.text();

      return {
        content: JSON.stringify(
          {
            url: input.url,
            status: res.status,
            mimeType,
            content,
          },
          null,
          2,
        ),
      };
    } catch (error) {
      if (context.signal?.aborted) {
        return { isError: true, isAborted: true, message: "Aborted" };
      }

      return {
        isError: true,
        message: `fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

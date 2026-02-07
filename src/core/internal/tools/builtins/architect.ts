import type Anthropic from "@anthropic-ai/sdk";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

export class ArchitectTool extends Tool {
  name = "architect";
  description = "Generate an implementation plan from a prompt. Input: { prompt }";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Planning request" },
        },
        required: ["prompt"],
      },
    };
  }

  override execute(
    input: { prompt: string },
    context: ToolExecutionContext,
  ): ToolExecutionResult {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    const plan = [
      "1. Clarify scope and acceptance criteria.",
      "2. Identify files/modules to modify.",
      "3. Implement smallest safe change first.",
      "4. Validate with typecheck/tests.",
      "5. Summarize risks and follow-up tasks.",
      "",
      `Prompt: ${input.prompt}`,
    ].join("\n");

    return {
      content: JSON.stringify({ plan }, null, 2),
    };
  }
}

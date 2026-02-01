import type Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";
import { Tool } from "./base";

export class BashTool extends Tool {
  name = "bash";
  description = "Execute bash commands in the terminal. Use this to run shell commands, scripts, or system operations.";

  getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute"
          }
        },
        required: ["command"]
      }
    };
  }

  execute(input: { command: string }): string {
    try {
      const result = execSync(input.command, {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });
      return result;
    } catch (error: any) {
      return `Error: ${error.message}\n${error.stderr || ""}`;
    }
  }
}

import type { ToolExecutionContext, ToolExecutionResult } from "../../tools/base";

export type RuntimeExecutionRequest = {
  toolName: string;
  input: unknown;
  context: ToolExecutionContext;
};

export type RuntimeExecutionResponse = {
  toolName: string;
  result: ToolExecutionResult;
};

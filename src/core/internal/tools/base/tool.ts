import type Anthropic from "@anthropic-ai/sdk";

export type ApprovalMode = "default" | "autoEdit" | "yolo";

export type ToolErrorResult =
  | { isError: true; isAborted?: false; message: string }
  | { isError: true; isAborted: true; message: string };

export type ToolSuccessResult = {
  content: string;
  filesChanged?: string[];
  preview?: string;
};

export type ToolExecutionResult = string | ToolSuccessResult | ToolErrorResult;

export function isToolErrorResult(
  value: ToolExecutionResult,
): value is ToolErrorResult {
  return typeof value === "object" && value !== null && "isError" in value;
}

export type ToolExecutionContext = {
  cwd: string;
  signal?: AbortSignal;
  approvalMode: ApprovalMode;
  sessionId: string;
};

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract readonly: boolean;

  abstract getSchema(): Anthropic.Tool;
  abstract execute(
    input: any,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> | ToolExecutionResult;

  getPreview?(input: any): string;
}

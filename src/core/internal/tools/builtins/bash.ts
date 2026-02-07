import type Anthropic from "@anthropic-ai/sdk";
import { spawn } from "child_process";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";
import { limitText } from "../guards/limits";

export class BashTool extends Tool {
  name = "bash";
  description = "Execute bash command. Input: { command, timeout? }";
  readonly = false;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute",
          },
          timeout: {
            type: "number",
            description: "Optional timeout in milliseconds (default 180000)",
          },
        },
        required: ["command"],
      },
    };
  }

  override getPreview(input: { command: string }): string {
    return `Run command:\n${input.command}`;
  }

  override async execute(
    input: { command: string; timeout?: number },
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    const timeout =
      typeof input.timeout === "number" && input.timeout > 0
        ? Math.min(input.timeout, 600000)
        : 180000;

    return runCommand(input.command, timeout, context.signal);
  }
}

async function runCommand(
  command: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  if (signal?.aborted) {
    return { isError: true, isAborted: true, message: "Aborted" };
  }

  return await new Promise<ToolExecutionResult>((resolve) => {
    const child = spawn("bash", ["-c", command], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let done = false;
    const startedAt = Date.now();

    const finish = (result: ToolExecutionResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
      resolve(result);
    };

    const onAbort = () => {
      try {
        child.kill("SIGKILL");
      } catch {}
      finish({ isError: true, isAborted: true, message: "Command was aborted" });
    };

    if (signal) signal.addEventListener("abort", onAbort);

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
      finish({
        isError: true,
        message: `Command timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      finish({
        isError: true,
        message: `Failed to execute command: ${error.message}`,
      });
    });

    child.on("close", (code) => {
      const limitedStdout = limitText(stdout, { maxLines: 2000 });
      const limitedStderr = limitText(stderr, { maxLines: 2000 });

      finish({
        content: JSON.stringify(
          {
            command,
            stdout: limitedStdout.content,
            stderr: limitedStderr.content,
            exitCode: code ?? 0,
            truncated: limitedStdout.truncated || limitedStderr.truncated,
            durationMs: Date.now() - startedAt,
          },
          null,
          2,
        ),
      });
    });
  });
}

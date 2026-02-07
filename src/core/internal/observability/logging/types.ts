export type SessionEvent =
  | { type: "session_start"; ts: string; sessionId: string; projectRoot: string }
  | { type: "user_message"; ts: string; content: string }
  | { type: "assistant_start"; ts: string; content: string }
  | { type: "assistant_delta"; ts: string; delta: string }
  | { type: "assistant_thinking_start"; ts: string; content: string; redacted?: boolean }
  | { type: "assistant_thinking_delta"; ts: string; delta: string }
  | { type: "assistant_thinking_end"; ts: string }
  | { type: "assistant_end"; ts: string }
  | { type: "stop"; ts: string; reason: string }
  | { type: "tool_use"; ts: string; toolName: string; input: unknown; preview?: string }
  | {
      type: "tool_result";
      ts: string;
      toolName: string;
      ok: boolean;
      content: string;
      filesChanged?: string[];
    }
  | {
      type: "confirm_request";
      ts: string;
      confirmId: string;
      toolName: string;
      reason: string;
      preview?: string;
    }
  | { type: "confirm_response"; ts: string; confirmId: string; allowed: boolean }
  | {
      type: "context_compaction_start";
      ts: string;
      reason: string;
      beforeTokens: number;
      tokenLimit: number;
      messageCount: number;
      aggressive: boolean;
    }
  | {
      type: "context_compaction_end";
      ts: string;
      reason: string;
      beforeTokens: number;
      afterTokens: number;
      removedMessages: number;
      summaryChars: number;
      aggressive: boolean;
    }
  | {
      type: "context_compaction_error";
      ts: string;
      reason: string;
      message: string;
    }
  | { type: "error"; ts: string; message: string; stack?: string };

export type EnvSnapshot = {
  ts: string;
  os: {
    platform: string;
    release: string;
    arch: string;
    cpus: number;
  };
  runtime: {
    bunVersion?: string;
    nodeVersion: string;
  };
  shell?: string;
  cwd: string;
  git?: {
    branch?: string;
    status?: string;
  };
};

export type ExportOptions = {
  sessionDir: string;
  outPath: string;
};

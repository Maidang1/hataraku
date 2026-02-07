export type ClaudeSettings = {
  env?: Record<string, string>;
  model?: string;
  apiKeyHelper?: string;
  mcpServers?: Record<string, McpServerConfig>;
  safety?: {
    allowedWriteRoots?: string[];
    autoAllowedBashPrefixes?: string[];
    autoAllowedTools?: string[];
  };
  logging?: {
    baseDir?: string;
  };
};

export type McpServerConfig = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  startupTimeoutSec?: number;
  toolTimeoutSec?: number;
  enabledTools?: string[];
  disabledTools?: string[];
  maxRetries?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  auth?: {
    type: "bearer" | "oauth" | "basic";
    token?: string;
    username?: string;
    password?: string;
  };
};

export type EffectiveConfig = {
  model: string;
  baseURL?: string;
  authToken?: string;
  apiKey?: string;
  mcpServers: Record<string, McpServerConfig>;
  safety?: ClaudeSettings["safety"];
  logging?: ClaudeSettings["logging"];
  sources: string[];
};

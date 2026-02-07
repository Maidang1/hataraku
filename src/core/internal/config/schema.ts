export type ClaudeSettings = {
  env?: Record<string, string>;
  model?: string;
  apiKeyHelper?: string;
  mcpServers?: Record<string, McpServerConfig>;
  context?: ContextSettings;
  safety?: {
    allowedWriteRoots?: string[];
    autoAllowedBashPrefixes?: string[];
    autoAllowedTools?: string[];
  };
  logging?: {
    baseDir?: string;
  };
};

export type ContextSettings = {
  modelContextWindowTokens?: number;
  modelAutoCompactTokenLimit?: number;
  compactPrompt?: string;
  compactMaxOutputTokens?: number;
  recentMessagesToKeep?: number;
  targetPostCompactRatio?: number;
  enableAutoCompact?: boolean;
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
  context?: ContextSettings;
  safety?: ClaudeSettings["safety"];
  logging?: ClaudeSettings["logging"];
  sources: string[];
};

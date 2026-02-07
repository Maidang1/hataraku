/**
 * MCP 模块共享常量
 */
export const MCP_CONSTANTS = {
  DEFAULT_CLIENT_NAME: "coding-agent",
  DEFAULT_CLIENT_VERSION: "1.0.0",
  DEFAULT_STARTUP_TIMEOUT_SEC: 30,
  DEFAULT_TOOL_TIMEOUT_SEC: 60,
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_INITIAL_RETRY_DELAY_MS: 1000,
  DEFAULT_MAX_RETRY_DELAY_MS: 30000,
  DEFAULT_JITTER_FACTOR: 0.1,
  DEFAULT_TOOL_CACHE_TTL_MINUTES: 5,
  DEFAULT_HEALTH_CHECK_INTERVAL_MS: 60000,
  CACHE_CLEANUP_INTERVAL_MS: 60000,
} as const;

/**
 * 将未知错误规范化为 Error 对象
 * @param error 未知错误
 * @param context 可选的上下文信息
 */
export function normalizeError(error: unknown, context?: string): Error {
  if (error instanceof Error) {
    return error;
  }

  const message = context
    ? `${context}: ${String(error)}`
    : `Unknown error: ${String(error)}`;

  return new Error(message);
}

/**
 * 创建超时 Promise
 * @param ms 超时时间（毫秒）
 * @param message 超时错误消息
 */
export function createTimeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}

import type { RetryConfig } from "./types";
import { ErrorType } from "./types";
import { MCP_CONSTANTS, normalizeError } from "./utils";

/**
 * 可重试错误的正则模式
 */
const RETRYABLE_PATTERNS =
  /econnrefused|etimedout|enotfound|socket hang up|network error|connection timeout|connection reset/i;

/**
 * 不可重试错误的正则模式
 */
const NON_RETRYABLE_PATTERNS =
  /unauthorized|forbidden|authentication|invalid config|protocol error/i;

/**
 * 重试策略 - 使用指数退避算法
 */
export class RetryStrategy {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: config?.maxRetries ?? MCP_CONSTANTS.DEFAULT_MAX_RETRIES,
      initialDelay: config?.initialDelay ?? MCP_CONSTANTS.DEFAULT_INITIAL_RETRY_DELAY_MS,
      maxDelay: config?.maxDelay ?? MCP_CONSTANTS.DEFAULT_MAX_RETRY_DELAY_MS,
      jitterFactor: config?.jitterFactor ?? MCP_CONSTANTS.DEFAULT_JITTER_FACTOR,
    };
  }

  /**
   * 计算下次重试的延迟时间（毫秒）
   * 使用指数退避算法：delay = min(initialDelay * 2^attempt, maxDelay) + jitter
   */
  getDelay(attempt: number): number {
    const exponentialDelay = this.config.initialDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // 添加抖动避免雷鸣群效应
    const jitter = cappedDelay * this.config.jitterFactor * Math.random();

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    return this.classifyError(error) === ErrorType.RETRYABLE;
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message;

    // 可重试的网络错误
    if (RETRYABLE_PATTERNS.test(message)) {
      return ErrorType.RETRYABLE;
    }

    // 不可重试的错误
    if (NON_RETRYABLE_PATTERNS.test(message)) {
      return ErrorType.NON_RETRYABLE;
    }

    // 默认可重试
    return ErrorType.RETRYABLE;
  }

  /**
   * 执行带重试的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number, delay: number) => void
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const err = normalizeError(error);
        lastError = err;

        if (!this.shouldRetry(attempt, err)) {
          throw err;
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.getDelay(attempt);
          onRetry?.(attempt + 1, delay);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error("Operation failed after retries");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

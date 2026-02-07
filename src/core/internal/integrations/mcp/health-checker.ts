import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { MCP_CONSTANTS, normalizeError } from "./utils";

/**
 * 健康检查器
 * 定期检查 MCP 服务器的健康状态
 */
export class HealthChecker {
  private interval: number;
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(intervalMs: number = MCP_CONSTANTS.DEFAULT_HEALTH_CHECK_INTERVAL_MS) {
    this.interval = intervalMs;
  }

  /**
   * 开始健康检查
   */
  start(
    serverName: string,
    client: Client,
    callbacks: {
      onHealthy?: (latency: number) => void;
      onUnhealthy?: (error: Error) => void;
    }
  ): void {
    // 清除已存在的定时器
    this.stop(serverName);

    const timer = setInterval(async () => {
      try {
        await this.check(serverName, client, callbacks);
      } catch (error) {
        callbacks.onUnhealthy?.(normalizeError(error, "Health check failed"));
      }
    }, this.interval);

    this.timers.set(serverName, timer);
  }

  /**
   * 停止健康检查
   */
  stop(serverName: string): void {
    const timer = this.timers.get(serverName);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(serverName);
    }
  }

  /**
   * 停止所有健康检查
   */
  stopAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  /**
   * 执行一次健康检查
   */
  private async check(
    _serverName: string,
    client: Client,
    callbacks: {
      onHealthy?: (latency: number) => void;
      onUnhealthy?: (error: Error) => void;
    }
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // 使用 listTools 作为健康检查探针
      await client.listTools();
      const latency = Date.now() - startTime;
      callbacks.onHealthy?.(latency);
    } catch (error) {
      callbacks.onUnhealthy?.(normalizeError(error, "Health check failed"));
    }
  }

  /**
   * 获取活跃的健康检查数量
   */
  getActiveCount(): number {
    return this.timers.size;
  }
}

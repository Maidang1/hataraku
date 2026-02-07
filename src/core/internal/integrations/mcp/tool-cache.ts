import type { Tool as McpToolDefinition } from "@modelcontextprotocol/sdk/types.js";
import { MCP_CONSTANTS } from "./utils";

/**
 * MCP 工具缓存项
 */
interface CacheEntry {
  tools: McpToolDefinition[];
  timestamp: number;
}

/**
 * MCP 工具缓存
 * 缓存 MCP 服务器的工具列表，减少重复的 listTools 调用
 */
export class McpToolCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number; // TTL in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttlMinutes: number = MCP_CONSTANTS.DEFAULT_TOOL_CACHE_TTL_MINUTES) {
    this.ttl = ttlMinutes * 60 * 1000;
    this.startCleanup();
  }

  /**
   * 获取缓存的工具列表
   */
  get(serverName: string): McpToolDefinition[] | null {
    const entry = this.cache.get(serverName);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      // 缓存过期
      this.cache.delete(serverName);
      return null;
    }

    return entry.tools;
  }

  /**
   * 设置缓存
   */
  set(serverName: string, tools: McpToolDefinition[]): void {
    this.cache.set(serverName, {
      tools,
      timestamp: Date.now(),
    });
  }

  /**
   * 使缓存失效
   */
  invalidate(serverName: string): void {
    this.cache.delete(serverName);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 启动自动清理过期缓存
   */
  private startCleanup(): void {
    // 每分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [serverName, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.ttl) {
          this.cache.delete(serverName);
        }
      }
    }, MCP_CONSTANTS.CACHE_CLEANUP_INTERVAL_MS);
  }

  /**
   * 停止自动清理
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

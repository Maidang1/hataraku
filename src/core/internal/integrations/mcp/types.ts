import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
  // 传输方式配置
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;

  // 启用/禁用控制
  enabled?: boolean; // 默认 true

  // 超时配置
  startupTimeoutSec?: number; // 启动超时（默认 30s）
  toolTimeoutSec?: number; // 工具调用超时（默认 60s）

  // 工具过滤
  enabledTools?: string[]; // 工具白名单
  disabledTools?: string[]; // 工具黑名单

  // 重连配置
  maxRetries?: number; // 最大重试次数（默认 3）
  retryDelay?: number; // 初始重试延迟（默认 1000ms）

  // 健康检查配置
  healthCheckInterval?: number; // 健康检查间隔（默认 60000ms）

  // 认证配置
  auth?: {
    type: "bearer" | "oauth" | "basic";
    token?: string;
    username?: string;
    password?: string;
  };
}

/**
 * 连接状态
 */
export enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  FAILED = "FAILED",
}

/**
 * 管理的连接
 */
export interface ManagedConnection {
  serverName: string;
  client: Client;
  transport: Transport;
  config: McpServerConfig;
  state: ConnectionState;
  lastError?: Error;
  retryCount: number;
  connectedAt?: Date;
  lastHealthCheck?: Date;
}

/**
 * 连接事件
 */
export interface ConnectionEvents {
  connectionStateChanged: (serverName: string, state: ConnectionState) => void;
  connectionError: (serverName: string, error: Error) => void;
  reconnectAttempt: (serverName: string, attempt: number, maxRetries: number) => void;
  healthCheckCompleted: (serverName: string, latency: number, healthy: boolean) => void;
}

/**
 * 重试策略配置
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  jitterFactor: number;
}

/**
 * 错误类型
 */
export enum ErrorType {
  RETRYABLE = "RETRYABLE",
  NON_RETRYABLE = "NON_RETRYABLE",
}

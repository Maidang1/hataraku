import { EventEmitter } from "events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  McpServerConfig,
  ManagedConnection,
  ConnectionState,
  ConnectionEvents,
} from "./types";
import { ConnectionState as State } from "./types";
import { RetryStrategy } from "./retry-strategy";
import { HealthChecker } from "./health-checker";
import { createTransport, connectWithTimeout } from "./transport";
import { MCP_CONSTANTS, normalizeError } from "./utils";

/**
 * 连接管理器
 * 管理多个 MCP 服务器连接的生命周期
 */
export class ConnectionManager extends EventEmitter {
  private connections: Map<string, ManagedConnection> = new Map();
  private healthChecker: HealthChecker;

  constructor() {
    super();
    this.healthChecker = new HealthChecker();
  }

  /**
   * 连接到 MCP 服务器
   */
  async connect(
    serverName: string,
    config: McpServerConfig
  ): Promise<Client> {
    // 检查是否已连接
    const existing = this.connections.get(serverName);
    if (existing && existing.state === State.CONNECTED) {
      return existing.client;
    }

    // 创建传输层和客户端
    const transport = createTransport(config);
    const client = new Client(
      { name: MCP_CONSTANTS.DEFAULT_CLIENT_NAME, version: MCP_CONSTANTS.DEFAULT_CLIENT_VERSION },
      { capabilities: {} }
    );

    // 创建连接记录
    const connection: ManagedConnection = {
      serverName,
      client,
      transport,
      config,
      state: State.CONNECTING,
      retryCount: 0,
    };

    this.connections.set(serverName, connection);
    this.emitStateChange(serverName, State.CONNECTING);

    try {
      // 使用重试策略连接
      const retryStrategy = new RetryStrategy({
        maxRetries: config.maxRetries,
        initialDelay: config.retryDelay,
      });

      await retryStrategy.executeWithRetry(
        async () => {
          await connectWithTimeout(
            client,
            transport,
            config.startupTimeoutSec ?? 30
          );
        },
        (attempt, _delay) => {
          connection.retryCount = attempt;
          this.emit("reconnectAttempt", serverName, attempt, config.maxRetries ?? MCP_CONSTANTS.DEFAULT_MAX_RETRIES);
        }
      );

      // 连接成功
      connection.state = State.CONNECTED;
      connection.connectedAt = new Date();
      connection.retryCount = 0;
      this.emitStateChange(serverName, State.CONNECTED);

      // 启动健康检查
      this.startHealthCheck(serverName, connection);

      return client;
    } catch (error) {
      // 连接失败
      const err = normalizeError(error, "Connection failed");
      connection.state = State.FAILED;
      connection.lastError = err;
      this.emitStateChange(serverName, State.FAILED);
      this.emit("connectionError", serverName, err);

      throw err;
    }
  }

  /**
   * 重新连接
   */
  async reconnect(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Connection not found: ${serverName}`);
    }

    // 先断开现有连接
    await this.disconnect(serverName);

    // 重新连接
    connection.state = State.RECONNECTING;
    this.emitStateChange(serverName, State.RECONNECTING);

    await this.connect(serverName, connection.config);
  }

  /**
   * 获取连接
   */
  getConnection(serverName: string): ManagedConnection | undefined {
    return this.connections.get(serverName);
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): ManagedConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 断开连接
   */
  async disconnect(serverName: string): Promise<void> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return;
    }

    // 停止健康检查
    this.healthChecker.stop(serverName);

    // 关闭客户端
    try {
      await connection.client.close();
    } catch (error) {
      const err = normalizeError(error);
      console.warn(`Failed to close MCP client "${serverName}": ${err.message}`);
    }

    connection.state = State.DISCONNECTED;
    this.emitStateChange(serverName, State.DISCONNECTED);
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    this.healthChecker.stopAll();

    await Promise.all(
      Array.from(this.connections.keys()).map((serverName) =>
        this.disconnect(serverName)
      )
    );

    this.connections.clear();
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(
    serverName: string,
    connection: ManagedConnection
  ): void {
    this.healthChecker.start(serverName, connection.client, {
      onHealthy: (latency) => {
        connection.lastHealthCheck = new Date();
        this.emit("healthCheckCompleted", serverName, latency, true);
      },
      onUnhealthy: (error) => {
        connection.lastError = error;
        this.emit("healthCheckCompleted", serverName, 0, false);

        // 尝试重新连接
        this.reconnect(serverName).catch((reconnectError) => {
          console.error(
            `Failed to reconnect "${serverName}":`,
            reconnectError instanceof Error
              ? reconnectError.message
              : String(reconnectError)
          );
        });
      },
    });
  }

  /**
   * 发射状态变化事件
   */
  private emitStateChange(serverName: string, state: ConnectionState): void {
    this.emit("connectionStateChanged", serverName, state);
  }

  /**
   * 类型安全的事件监听
   */
  override on<K extends keyof ConnectionEvents>(
    event: K,
    listener: ConnectionEvents[K]
  ): this {
    return super.on(event, listener);
  }

  /**
   * 类型安全的事件发射
   */
  override emit<K extends keyof ConnectionEvents>(
    event: K,
    ...args: Parameters<ConnectionEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

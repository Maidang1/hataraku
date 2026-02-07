import { URL } from "url";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServerConfig } from "./types";
import { MCP_CONSTANTS, createTimeoutPromise } from "./utils";

/**
 * 创建传输层
 */
export function createTransport(config: McpServerConfig): Transport {
  if (config.command) {
    return new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: config.env,
      cwd: config.cwd,
    });
  }

  if (config.url) {
    const headers = { ...config.headers };

    // 添加认证 header
    if (config.auth) {
      if (config.auth.type === "bearer" && config.auth.token) {
        headers["Authorization"] = `Bearer ${config.auth.token}`;
      } else if (config.auth.type === "basic" && config.auth.username && config.auth.password) {
        const credentials = Buffer.from(
          `${config.auth.username}:${config.auth.password}`
        ).toString("base64");
        headers["Authorization"] = `Basic ${credentials}`;
      }
      // OAuth 需要更复杂的实现，暂时不支持
    }

    return new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: Object.keys(headers).length > 0 ? { headers } : undefined,
    });
  }

  throw new Error("MCP server config must include command or url.");
}

/**
 * 带超时的连接
 */
export async function connectWithTimeout(
  client: Client,
  transport: Transport,
  timeoutSec: number = MCP_CONSTANTS.DEFAULT_STARTUP_TIMEOUT_SEC
): Promise<void> {
  await Promise.race([
    client.connect(transport),
    createTimeoutPromise(timeoutSec * 1000, `Connection timeout after ${timeoutSec}s`),
  ]);
}

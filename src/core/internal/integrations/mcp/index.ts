import type Anthropic from "@anthropic-ai/sdk";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool as McpToolDefinition } from "@modelcontextprotocol/sdk/types.js";
import { getEffectiveConfig, type McpServerConfig } from "../../config";
import { Tool } from "../../tools/base";
import type { ToolExecutionContext } from "../../tools/base";
import { ConnectionManager } from "./connection-manager";
import { McpToolCache } from "./tool-cache";
import { ConnectionState } from "./types";
import { MCP_CONSTANTS, normalizeError, createTimeoutPromise } from "./utils";

class McpTool extends Tool {
  name: string;
  description: string;
  readonly = false;
  private client: Client;
  private toolName: string;
  private inputSchema: Anthropic.Tool["input_schema"];
  private config: McpServerConfig;

  constructor(params: {
    serverName: string;
    tool: McpToolDefinition;
    client: Client;
    config: McpServerConfig;
  }) {
    super();
    const { serverName, tool, client, config } = params;
    this.name = `${serverName}.${tool.name}`;
    this.description = tool.description ?? `MCP tool ${tool.name} from ${serverName}`;
    this.client = client;
    this.toolName = tool.name;
    this.config = config;
    this.inputSchema =
      (tool.inputSchema as Anthropic.Tool["input_schema"]) ?? {
        type: "object",
        properties: {},
      };
  }

  getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.inputSchema,
    };
  }

  async execute(
    input: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<string> {
    const timeoutMs = this.config.toolTimeoutSec
      ? this.config.toolTimeoutSec * 1000
      : MCP_CONSTANTS.DEFAULT_TOOL_TIMEOUT_SEC * 1000;

    const result = await Promise.race([
      this.client.callTool({
        name: this.toolName,
        arguments: input ?? {},
      }),
      createTimeoutPromise(timeoutMs, `Tool execution timeout after ${timeoutMs}ms`),
    ]);

    return formatToolResult(result);
  }
}

function formatToolResult(result: unknown): string {
  if (!result) return "";

  const resultObj = result as Record<string, unknown>;
  const content = resultObj.content ?? result;

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    const parts = content.map((part: unknown) => {
      const partObj = part as Record<string, unknown> | null;
      if (partObj?.type === "text" && typeof partObj.text === "string") {
        return partObj.text;
      }
      return JSON.stringify(part, null, 2);
    });
    return parts.join("\n");
  }

  return JSON.stringify(content, null, 2);
}

/**
 * 过滤工具列表
 */
function filterTools(
  tools: McpToolDefinition[],
  config: McpServerConfig
): McpToolDefinition[] {
  let filtered = tools;

  // 白名单过滤
  if (config.enabledTools && config.enabledTools.length > 0) {
    filtered = filtered.filter((tool) =>
      config.enabledTools!.includes(tool.name)
    );
  }

  // 黑名单过滤
  if (config.disabledTools && config.disabledTools.length > 0) {
    filtered = filtered.filter((tool) =>
      !config.disabledTools!.includes(tool.name)
    );
  }

  return filtered;
}

export async function loadMcpTools(
  mcpServersOverride?: Record<string, McpServerConfig>,
  hooks?: {
    onServerConnectStart?: (serverName: string) => void;
    onServerConnectSuccess?: (serverName: string, toolCount: number) => void;
    onServerConnectError?: (serverName: string, error: Error) => void;
    onReconnectAttempt?: (serverName: string, attempt: number, maxRetries: number) => void;
    onHealthCheck?: (serverName: string, latency: number, healthy: boolean) => void;
    onCacheHit?: (serverName: string) => void;
  }
): Promise<{
  tools: Tool[];
  cleanup: () => Promise<void>;
  connectionManager: ConnectionManager;
}> {
  const { mcpServers } = getEffectiveConfig();
  const mcpServersToUse = mcpServersOverride ?? mcpServers;
  const tools: Tool[] = [];
  const connectionManager = new ConnectionManager();
  const toolCache = new McpToolCache();

  // 设置事件监听
  connectionManager.on("reconnectAttempt", (serverName, attempt, maxRetries) => {
    hooks?.onReconnectAttempt?.(serverName, attempt, maxRetries);
  });

  connectionManager.on("healthCheckCompleted", (serverName, latency, healthy) => {
    hooks?.onHealthCheck?.(serverName, latency, healthy);
  });

  const serverEntries = Object.entries(mcpServersToUse);
  for (const [serverName, config] of serverEntries) {
    // 检查是否启用
    if (config.enabled === false) {
      continue;
    }

    try {
      hooks?.onServerConnectStart?.(serverName);

      // 连接到服务器
      const client = await connectionManager.connect(serverName, config);

      // 尝试从缓存获取工具列表
      let serverTools = toolCache.get(serverName);
      if (serverTools) {
        hooks?.onCacheHit?.(serverName);
      } else {
        // 从服务器获取工具列表
        const result = await client.listTools();
        serverTools = result.tools ?? [];
        toolCache.set(serverName, serverTools);
      }

      // 过滤工具
      const filteredTools = filterTools(serverTools, config);

      // 创建工具实例
      for (const tool of filteredTools) {
        tools.push(new McpTool({ serverName, tool, client, config }));
      }

      hooks?.onServerConnectSuccess?.(serverName, filteredTools.length);
    } catch (error) {
      const err = normalizeError(error);
      console.warn(`Failed to load MCP server "${serverName}": ${err.message}`);
      hooks?.onServerConnectError?.(serverName, err);
    }
  }

  const cleanup = async () => {
    toolCache.stopCleanup();
    await connectionManager.disconnectAll();
  };

  return { tools, cleanup, connectionManager };
}

// 导出类型和工具
export { ConnectionManager, McpToolCache, ConnectionState };
export type { McpServerConfig };

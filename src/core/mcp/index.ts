import type Anthropic from "@anthropic-ai/sdk";
import { URL } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool as McpToolDefinition } from "@modelcontextprotocol/sdk/types.js";
import { getEffectiveConfig, type McpServerConfig } from "../config";
import { Tool } from "../tools/base";

type McpClientEntry = {
  serverName: string;
  client: Client;
};

class McpTool extends Tool {
  name: string;
  description: string;
  private client: Client;
  private toolName: string;
  private inputSchema: Anthropic.Tool["input_schema"];

  constructor(params: {
    serverName: string;
    tool: McpToolDefinition;
    client: Client;
  }) {
    super();
    const { serverName, tool, client } = params;
    this.name = `${serverName}.${tool.name}`;
    this.description = tool.description ?? `MCP tool ${tool.name} from ${serverName}`;
    this.client = client;
    this.toolName = tool.name;
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

  async execute(input: any): Promise<string> {
    const result = await this.client.callTool({
      name: this.toolName,
      arguments: input ?? {},
    });
    return formatToolResult(result);
  }
}

function formatToolResult(result: any): string {
  if (!result) return "";
  const content = result.content ?? result;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = content.map((part) => {
      if (part?.type === "text" && typeof part.text === "string") {
        return part.text;
      }
      return JSON.stringify(part, null, 2);
    });
    return parts.join("\n");
  }
  return JSON.stringify(content, null, 2);
}

function createTransport(config: McpServerConfig) {
  if (config.command) {
    return new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: config.env,
      cwd: config.cwd,
    });
  }
  if (config.url) {
    return new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: config.headers ? { headers: config.headers } : undefined,
    });
  }
  throw new Error("MCP server config must include command or url.");
}

export async function loadMcpTools(
  mcpServersOverride?: Record<string, McpServerConfig>,
  hooks?: {
    onServerConnectStart?: (serverName: string) => void;
    onServerConnectSuccess?: (serverName: string, toolCount: number) => void;
    onServerConnectError?: (serverName: string, error: Error) => void;
  },
): Promise<{
  tools: Tool[];
  cleanup: () => Promise<void>;
}> {
  const { mcpServers } = getEffectiveConfig();
  const mcpServersToUse = mcpServersOverride ?? mcpServers;
  const tools: Tool[] = [];
  const clients: McpClientEntry[] = [];

  const serverEntries = Object.entries(mcpServersToUse);
  for (const [serverName, config] of serverEntries) {
    try {
      hooks?.onServerConnectStart?.(serverName);
      const transport = createTransport(config);
      const client = new Client(
        { name: "coding-agent", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      const { tools: serverTools } = await client.listTools();
      for (const tool of serverTools ?? []) {
        tools.push(new McpTool({ serverName, tool, client }));
      }
      clients.push({ serverName, client });
      hooks?.onServerConnectSuccess?.(serverName, (serverTools ?? []).length);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(`Unknown error: ${String(error)}`);
      const message = normalizedError.message;
      console.warn(`Failed to load MCP server "${serverName}": ${message}`);
      hooks?.onServerConnectError?.(serverName, normalizedError);
    }
  }

  const cleanup = async () => {
    await Promise.all(
      clients.map(async ({ client }) => {
        try {
          await client.close();
        } catch (error) {
          console.warn(
            `Failed to close MCP client: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }),
    );
  };

  return { tools, cleanup };
}

import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";
import { setLoading } from "../../render/state/loading";
import { Tool, bashTool } from "../tools";
import { getEffectiveConfig, type McpServerConfig } from "../config";
import { loadMcpTools } from "../mcp";

function repairJsonIfUnbalanced(value: string): string {
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (const char of value) {
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") stack.push("}");
    if (char === "[") stack.push("]");
    if (char === "}" || char === "]") {
      const expected = stack.pop();
      if (expected && expected !== char) {
        stack.push(expected);
      }
    }
  }

  if (stack.length === 0) return value;
  return value + stack.reverse().join("");
}

function parseToolInput(jsonStr: string): any | undefined {
  const trimmed = jsonStr.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    const repaired = repairJsonIfUnbalanced(trimmed);
    if (repaired !== trimmed) {
      try {
        return JSON.parse(repaired);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

export interface AgentEvents {
  userMessage: (message: { role: "user"; content: string }) => void;
  assistantMessageStart: (message: {
    role: "assistant";
    content: string;
  }) => void;
  assistantMessageDelta: (delta: string) => void;
  assistantMessageEnd: () => void;
  toolUse: (toolName: string, input: any) => void;
  toolResult: (toolName: string, result: string) => void;
  mcpServerConnectStart: (serverName: string) => void;
  mcpServerConnectSuccess: (serverName: string, toolCount: number) => void;
  mcpServerConnectError: (serverName: string, error: Error) => void;
  error: (error: Error) => void;
}

class Agent extends EventEmitter {
  model: string;
  client: Anthropic;
  conversationHistory: Anthropic.MessageParam[] = [];
  tools: Map<string, Tool> = new Map();
  mcpServers?: Record<string, McpServerConfig>;
  cleanupMcp?: () => Promise<void>;
  private mcpLoaded = false;

  constructor(params: {
    model: string;
    client?: Anthropic;
    tools?: Map<string, Tool>;
    mcpServers?: Record<string, McpServerConfig>;
  }) {
    const { model, client, tools, mcpServers } = params;
    super();
    this.model = model;
    const config = getEffectiveConfig();
    this.client =
      client ??
      new Anthropic({
        baseURL: config.baseURL || process.env.ANTHROPIC_BASE_URL,
        authToken: config.authToken || process.env.ANTHROPIC_AUTH_TOKEN,
        apiKey: config.apiKey,
      });
    this.tools = new Map<string, Tool>(tools ?? []);
    this.tools.set(bashTool.name, bashTool);
    this.mcpServers = mcpServers;
  }

  async init(params: { includeMcpTools?: boolean } = {}): Promise<void> {
    const { includeMcpTools } = params;
    if (includeMcpTools ?? true) {
      if (this.mcpLoaded) return;
      const { tools: mcpTools, cleanup } = await loadMcpTools(this.mcpServers, {
        onServerConnectStart: (serverName) => {
          this.emit("mcpServerConnectStart", serverName);
        },
        onServerConnectSuccess: (serverName, toolCount) => {
          this.emit("mcpServerConnectSuccess", serverName, toolCount);
        },
        onServerConnectError: (serverName, error) => {
          this.emit("mcpServerConnectError", serverName, error);
        },
      });
      for (const tool of mcpTools) {
        this.tools.set(tool.name, tool);
      }
      this.cleanupMcp = cleanup;
      this.mcpLoaded = true;
    }
  }


  private getToolSchemas(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((tool) => tool.getSchema());
  }

  private async executeTool(toolName: string, input: any): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return `Error: Unknown tool "${toolName}"`;
    }
    return await tool.execute(input);
  }

  async runStream(input: string) {
    try {
      setLoading(true);
      this.emit("userMessage", { role: "user", content: input });

      // 添加用户消息到历史
      this.conversationHistory.push({ role: "user", content: input });

      let continueLoop = true;

      while (continueLoop) {
        const stream = await this.client.messages.create({
          max_tokens: 1024,
          messages: this.conversationHistory,
          model: this.model,
          stream: true,
          tools: this.getToolSchemas(),
        });

        let isFirstDelta = true;
        let currentContent: Anthropic.ContentBlock[] = [];
        let stopReason: string | null = null;
        // 用于存储每个 tool_use block 的 input JSON 字符串
        const toolInputJsonMap = new Map<number, string>();

        for await (const messageEvent of stream) {
          if (messageEvent.type === "content_block_start") {
            currentContent.push(messageEvent.content_block);
            if (messageEvent.content_block.type === "tool_use") {
              toolInputJsonMap.set(messageEvent.index, "");
            }
          } else if (messageEvent.type === "content_block_delta") {
            const index = messageEvent.index;
            if (messageEvent.delta.type === "text_delta") {
              if (isFirstDelta) {
                this.emit("assistantMessageStart", {
                  role: "assistant",
                  content: messageEvent.delta.text,
                });
                isFirstDelta = false;
              } else {
                this.emit("assistantMessageDelta", messageEvent.delta.text);
              }
              // 更新内容
              if (
                currentContent[index] &&
                currentContent[index].type === "text"
              ) {
                (currentContent[index] as Anthropic.TextBlock).text +=
                  messageEvent.delta.text;
              }
            } else if (messageEvent.delta.type === "input_json_delta") {
              // 累积 tool input JSON 字符串
              const currentJson = toolInputJsonMap.get(index) || "";
              toolInputJsonMap.set(
                index,
                currentJson + messageEvent.delta.partial_json,
              );
            }
          } else if (messageEvent.type === "message_delta") {
            stopReason = messageEvent.delta.stop_reason || null;
          }
        }

        // 解析所有 tool_use 的 input
        currentContent.forEach((block, index) => {
          if (block.type === "tool_use") {
            const jsonStr = toolInputJsonMap.get(index);
            if (!jsonStr) return;
            const parsed = parseToolInput(jsonStr);
            if (parsed !== undefined) {
              (block as Anthropic.ToolUseBlock).input = parsed;
            } else {
              console.warn(
                "Failed to parse tool input JSON:",
                jsonStr.length > 500 ? `${jsonStr.slice(0, 500)}...` : jsonStr,
              );
              (block as Anthropic.ToolUseBlock).input = {};
            }
          }
        });

        this.emit("assistantMessageEnd");

        // 添加助手响应到历史
        this.conversationHistory.push({
          role: "assistant",
          content: currentContent,
        });

        // 检查是否需要执行 tool
        if (stopReason === "tool_use") {
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of currentContent) {
            if (block.type === "tool_use") {
              const toolName = block.name;
              const toolInput = block.input;
              this.emit("toolUse", toolName, toolInput);
              const result = await this.executeTool(toolName, toolInput);
              this.emit("toolResult", toolName, result);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }
          }

          // 添加 tool 结果到历史
          this.conversationHistory.push({ role: "user", content: toolResults });
        } else {
          continueLoop = false;
        }
      }
    } catch (error) {
      this.emit("error", error as Error);
    } finally {
      setLoading(false);
    }
  }
}

export { Agent };

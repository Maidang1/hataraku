import type Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";
import { setLoading } from "../../render/state/loading";
import { Tool } from "../tools";

export interface AgentEvents {
  userMessage: (message: { role: "user"; content: string }) => void;
  assistantMessageStart: (message: { role: "assistant"; content: string }) => void;
  assistantMessageDelta: (delta: string) => void;
  assistantMessageEnd: () => void;
  toolUse: (toolName: string, input: any) => void;
  toolResult: (toolName: string, result: string) => void;
  error: (error: Error) => void;
}

class Agent extends EventEmitter {
  model: string;
  client: Anthropic;
  conversationHistory: Anthropic.MessageParam[] = [];
  tools: Map<string, Tool> = new Map();

  constructor(model: string, client: Anthropic, tools: Map<string, Tool>) {
    super();
    this.model = model;
    this.client = client;
    this.tools = tools;
  }



  private getToolSchemas(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map(tool => tool.getSchema());
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
          tools: this.getToolSchemas()
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
                this.emit("assistantMessageStart", { role: "assistant", content: messageEvent.delta.text });
                isFirstDelta = false;
              } else {
                this.emit("assistantMessageDelta", messageEvent.delta.text);
              }
              // 更新内容
              if (currentContent[index] && currentContent[index].type === "text") {
                (currentContent[index] as Anthropic.TextBlock).text += messageEvent.delta.text;
              }
            } else if (messageEvent.delta.type === "input_json_delta") {
              // 累积 tool input JSON 字符串
              const currentJson = toolInputJsonMap.get(index) || "";
              toolInputJsonMap.set(index, currentJson + messageEvent.delta.partial_json);
            }
          } else if (messageEvent.type === "message_delta") {
            stopReason = messageEvent.delta.stop_reason || null;
          }
        }

        // 解析所有 tool_use 的 input
        currentContent.forEach((block, index) => {
          if (block.type === "tool_use") {
            const jsonStr = toolInputJsonMap.get(index);
            if (jsonStr) {
              try {
                (block as Anthropic.ToolUseBlock).input = JSON.parse(jsonStr);
              } catch (e) {
                console.error("Failed to parse tool input JSON:", jsonStr, e);
                (block as Anthropic.ToolUseBlock).input = {};
              }
            }
          }
        });

        this.emit("assistantMessageEnd");

        // 添加助手响应到历史
        this.conversationHistory.push({ role: "assistant", content: currentContent });

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
                content: result
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
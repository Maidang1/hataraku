import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";
import { setLoading } from "../../render/state/loading";
import { Tool, bashTool, searchTool, SkillsTool, FsReadTool, FsWriteTool, FsPatchTool } from "../tools";
import { getEffectiveConfig, type McpServerConfig } from "../config";
import { loadMcpTools } from "../mcp";
import { SkillsManager, type SkillLoadOutcome, type SkillMetadata } from "../skills";
import { McpDependencyLoader } from "../skills/integration/mcp-loader";
import * as os from "os";
import * as path from "path";
import { SafetyPolicy } from "../safety";
import { SessionLogger, collectEnvSnapshot } from "../logging";
import type { ToolExecutionResult } from "../tools/base";

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
  assistantThinkingStart: (message: { role: "thinking"; content: string; redacted?: boolean }) => void;
  assistantThinkingDelta: (delta: string) => void;
  assistantThinkingEnd: () => void;
  toolUse: (event: { toolUseId: string; toolName: string; input: unknown; preview?: string }) => void;
  toolResult: (event: {
    toolUseId: string;
    toolName: string;
    result: string;
    filesChanged?: string[];
  }) => void;
  confirmRequest: (request: {
    id: string;
    toolName: string;
    reason: string;
    preview?: string;
  }) => void;
  mcpServerConnectStart: (serverName: string) => void;
  mcpServerConnectSuccess: (serverName: string, toolCount: number) => void;
  mcpServerConnectError: (serverName: string, error: Error) => void;
  mcpReconnectAttempt: (serverName: string, attempt: number, maxRetries: number) => void;
  mcpHealthCheck: (serverName: string, latency: number, healthy: boolean) => void;
  mcpCacheHit: (serverName: string) => void;
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
  private skillsManager: SkillsManager;
  private loadedSkills: SkillLoadOutcome | null = null;
  private injectedSkillDetails: Map<string, string> = new Map();
  readonly sessionId: string;
  private projectRoot: string;
  private safety: SafetyPolicy;
  private logger: SessionLogger;
  private confirmResolvers: Map<string, (allowed: boolean) => void> = new Map();
  private confirmCounter = 0;
  private localToolCounter = 0;
  readonly maxTokens = 4096;
  private thinkingEnabled = false;
  private thinkingBudgetTokens = 2048;

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
    this.projectRoot = process.cwd();
    this.sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const allowedWriteRoots = config.safety?.allowedWriteRoots?.map((p) =>
      path.isAbsolute(p) ? p : path.resolve(this.projectRoot, p),
    );
    const baseDirRaw = config.logging?.baseDir;
    const baseDir = baseDirRaw
      ? path.isAbsolute(baseDirRaw)
        ? baseDirRaw
        : path.resolve(this.projectRoot, baseDirRaw)
      : undefined;

    this.safety = new SafetyPolicy({
      projectRoot: this.projectRoot,
      allowedWriteRoots,
      autoAllowedBashPrefixes: config.safety?.autoAllowedBashPrefixes,
    });
    this.logger = new SessionLogger({ sessionId: this.sessionId, projectRoot: this.projectRoot, baseDir });
    this.logger.writeJson("env.json", collectEnvSnapshot(this.projectRoot));

    this.tools.set(bashTool.name, bashTool);
    this.tools.set(searchTool.name, searchTool);
    this.tools.set("fs_read", new FsReadTool({ projectRoot: this.projectRoot }));
    this.tools.set("fs_write", new FsWriteTool({ projectRoot: this.projectRoot }));
    this.tools.set("fs_patch", new FsPatchTool({ projectRoot: this.projectRoot }));
    const skillsTool = new SkillsTool({
      listSkills: () => this.loadedSkills?.skills ?? [],
      getSkillByName: (name) => this.findSkillByName(name),
      injectSkillDetails: (name, details) => this.injectSkillDetails(name, details),
    });
    this.tools.set(skillsTool.name, skillsTool);
    this.mcpServers = mcpServers;
    
    // Initialize SkillsManager
    const codexHome = path.join(os.homedir(), ".codex");
    this.skillsManager = new SkillsManager(codexHome);
  }

  confirmResponse(confirmId: string, allowed: boolean): void {
    const resolver = this.confirmResolvers.get(confirmId);
    if (!resolver) return;
    this.confirmResolvers.delete(confirmId);
    this.logger.append({ type: "confirm_response", ts: new Date().toISOString(), confirmId, allowed });
    resolver(allowed);
  }

  getThinkingState(): { enabled: boolean; budgetTokens: number } {
    return {
      enabled: this.thinkingEnabled,
      budgetTokens: this.thinkingBudgetTokens,
    };
  }

  setThinking(params: { enabled: boolean; budgetTokens?: number }): { enabled: boolean; budgetTokens: number } {
    const { enabled, budgetTokens } = params;
    this.thinkingEnabled = enabled;
    if (enabled && budgetTokens !== undefined) {
      this.thinkingBudgetTokens = budgetTokens;
    }
    return this.getThinkingState();
  }

  private requestConfirmation(params: { toolName: string; reason: string; preview?: string }): Promise<boolean> {
    const id = `${Date.now()}-${++this.confirmCounter}`;
    this.logger.append({
      type: "confirm_request",
      ts: new Date().toISOString(),
      confirmId: id,
      toolName: params.toolName,
      reason: params.reason,
      preview: params.preview,
    });
    this.emit("confirmRequest", { id, toolName: params.toolName, reason: params.reason, preview: params.preview });
    return new Promise<boolean>((resolve) => {
      this.confirmResolvers.set(id, resolve);
    });
  }

  async init(params: { includeMcpTools?: boolean } = {}): Promise<void> {
    // Load skills
    const cwd = process.cwd();
    this.loadedSkills = await this.skillsManager.getSkillsForCwd(cwd);

    // Process skill dependencies using the new dependency loader
    if (this.loadedSkills && this.loadedSkills.skills.length > 0) {
      const mcpLoader = new McpDependencyLoader();
      const { mcpServers, warnings } = mcpLoader.loadDependencies(
        this.loadedSkills.skills,
        this.mcpServers
      );

      // 报告警告
      for (const warning of warnings) {
        console.warn(`[Skills] ${warning}`);
      }

      // 合并 MCP 服务器配置
      this.mcpServers = mcpServers;

      // 验证依赖
      const validation = mcpLoader.validateDependencies(
        this.loadedSkills.skills,
        mcpServers
      );

      if (!validation.valid) {
        for (const missing of validation.missingDependencies) {
          console.warn(
            `[Skills] Skill "${missing.skill}" requires MCP server "${missing.server}" but it is not configured`
          );
        }
      }
    }

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
        onReconnectAttempt: (serverName, attempt, maxRetries) => {
          this.emit("mcpReconnectAttempt", serverName, attempt, maxRetries);
        },
        onHealthCheck: (serverName, latency, healthy) => {
          this.emit("mcpHealthCheck", serverName, latency, healthy);
        },
        onCacheHit: (serverName) => {
          this.emit("mcpCacheHit", serverName);
        },
      });
      for (const tool of mcpTools) {
        this.tools.set(tool.name, tool);
      }
      this.cleanupMcp = cleanup;
      this.mcpLoaded = true;
    }
  }


  private getSystemPrompt(): string {
    let prompt = "You are a helpful coding assistant.\n";
    prompt +=
      "\nYou can use tools to read/search files, write/patch files, and run shell commands.\n" +
      "- Read-only tools are auto-allowed.\n" +
      "- Writes and most commands require user confirmation.\n";
    
    if (this.loadedSkills && this.loadedSkills.skills.length > 0) {
        prompt += "\n## Skills Index\n";
        prompt += "You have access to the following skills. Use the `skills` tool with action `get` to inject full instructions when needed.\n\n";
        
        for (const skill of this.loadedSkills.skills) {
            prompt += `- ${skill.name}: ${skill.description}`;
            if (skill.shortDescription) {
                prompt += ` (${skill.shortDescription})`;
            }
            prompt += "\n";
        }
    }

    if (this.injectedSkillDetails.size > 0) {
        prompt += "\n## Skill Details (Injected)\n";
        for (const [name, details] of this.injectedSkillDetails.entries()) {
            prompt += `\n### ${name}\n`;
            prompt += `${details}\n`;
        }
    }
    return prompt;
  }

  private findSkillByName(name: string): SkillMetadata | undefined {
    if (!this.loadedSkills) return undefined;
    const needle = name.trim().toLowerCase();
    return this.loadedSkills.skills.find(skill => skill.name.toLowerCase() === needle);
  }

  private injectSkillDetails(name: string, details: string): boolean {
    if (this.injectedSkillDetails.has(name)) return false;
    this.injectedSkillDetails.set(name, details);
    return true;
  }

  private getToolSchemas(): Anthropic.Tool[] {
    return Array.from(this.tools.values()).map((tool) => tool.getSchema());
  }

  private normalizeToolResult(result: ToolExecutionResult): { content: string; filesChanged?: string[] } {
    if (typeof result === "string") return { content: result };
    return { content: result.content, filesChanged: result.filesChanged };
  }

  private async executeTool(toolName: string, input: unknown): Promise<{ content: string; filesChanged?: string[] }> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { content: `Error: Unknown tool "${toolName}"` };
    }

    const preview = tool.getPreview?.(input as any);
    const decision = this.safety.decide({ type: "tool", toolName, input, preview });
    if (!decision.allowed) {
      return { content: `Blocked by safety policy: ${decision.reason}` };
    }

    if (decision.requiresConfirm) {
      const allowed = await this.requestConfirmation({ toolName, reason: decision.reason, preview });
      if (!allowed) return { content: `Cancelled by user: ${toolName}` };
    }

    this.logger.append({ type: "tool_use", ts: new Date().toISOString(), toolName, input, preview });
    try {
      const raw = await tool.execute(input);
      const normalized = this.normalizeToolResult(raw);
      this.logger.append({
        type: "tool_result",
        ts: new Date().toISOString(),
        toolName,
        ok: true,
        content: normalized.content,
        filesChanged: normalized.filesChanged,
      });
      if (normalized.filesChanged?.length) {
        this.logger.recordFilesChanged(normalized.filesChanged);
      }
      return normalized;
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.append({
        type: "tool_result",
        ts: new Date().toISOString(),
        toolName,
        ok: false,
        content: message,
      });
      return { content: `Error: ${message}` };
    }
  }

  async runTool(params: { toolName: string; input: unknown; toolUseId?: string; preview?: string }): Promise<{
    content: string;
    filesChanged?: string[];
  }> {
    const toolUseId = params.toolUseId ?? `local-${Date.now()}-${++this.localToolCounter}`;
    const preview = params.preview ?? this.tools.get(params.toolName)?.getPreview?.(params.input as any);
    this.emit("toolUse", { toolUseId, toolName: params.toolName, input: params.input, preview });
    const result = await this.executeTool(params.toolName, params.input);
    this.emit("toolResult", {
      toolUseId,
      toolName: params.toolName,
      result: result.content,
      filesChanged: result.filesChanged,
    });
    return result;
  }

  async runStream(input: string) {
    try {
      setLoading(true);
      this.emit("userMessage", { role: "user", content: input });
      this.logger.append({ type: "user_message", ts: new Date().toISOString(), content: input });

      // 添加用户消息到历史
      this.conversationHistory.push({ role: "user", content: input });

      let continueLoop = true;

      while (continueLoop) {
        const thinking = this.thinkingEnabled
          ? ({
              type: "enabled",
              budget_tokens: this.thinkingBudgetTokens,
            } satisfies Anthropic.ThinkingConfigEnabled)
          : undefined;
        const stream = await this.client.messages.create({
          max_tokens: this.maxTokens,
          messages: this.conversationHistory,
          model: this.model,
          stream: true,
          system: this.getSystemPrompt(),
          tools: this.getToolSchemas(),
          thinking,
        });

        let isFirstDelta = true;
        let currentContent: Anthropic.ContentBlock[] = [];
        let stopReason: string | null = null;
        let thinkingStarted = false;
        let thinkingEnded = false;
        // 用于存储每个 tool_use block 的 input JSON 字符串
        const toolInputJsonMap = new Map<number, string>();

        const startThinking = (initialContent: string, redacted = false) => {
          if (thinkingStarted) return;
          this.emit("assistantThinkingStart", { role: "thinking", content: initialContent, redacted });
          this.logger.append({
            type: "assistant_thinking_start",
            ts: new Date().toISOString(),
            content: initialContent,
            redacted,
          });
          thinkingStarted = true;
          thinkingEnded = false;
        };

        const appendThinking = (delta: string) => {
          if (!thinkingStarted) {
            startThinking(delta);
            return;
          }
          this.emit("assistantThinkingDelta", delta);
          this.logger.append({
            type: "assistant_thinking_delta",
            ts: new Date().toISOString(),
            delta,
          });
        };

        const endThinking = () => {
          if (!thinkingStarted || thinkingEnded) return;
          this.emit("assistantThinkingEnd");
          this.logger.append({ type: "assistant_thinking_end", ts: new Date().toISOString() });
          thinkingEnded = true;
        };

        for await (const messageEvent of stream) {
          if (messageEvent.type === "content_block_start") {
            currentContent[messageEvent.index] = messageEvent.content_block;
            if (messageEvent.content_block.type === "tool_use") {
              toolInputJsonMap.set(messageEvent.index, "");
            } else if (messageEvent.content_block.type === "redacted_thinking") {
              startThinking("[thinking is redacted]", true);
              endThinking();
            }
          } else if (messageEvent.type === "content_block_delta") {
            const index = messageEvent.index;
            if (messageEvent.delta.type === "text_delta") {
              endThinking();
              if (isFirstDelta) {
                this.emit("assistantMessageStart", {
                  role: "assistant",
                  content: messageEvent.delta.text,
                });
                this.logger.append({
                  type: "assistant_start",
                  ts: new Date().toISOString(),
                  content: messageEvent.delta.text,
                });
                isFirstDelta = false;
              } else {
                this.emit("assistantMessageDelta", messageEvent.delta.text);
                this.logger.append({
                  type: "assistant_delta",
                  ts: new Date().toISOString(),
                  delta: messageEvent.delta.text,
                });
              }
              // 更新内容
              if (
                currentContent[index] &&
                currentContent[index].type === "text"
              ) {
                (currentContent[index] as Anthropic.TextBlock).text +=
                  messageEvent.delta.text;
              }
            } else if (messageEvent.delta.type === "thinking_delta") {
              appendThinking(messageEvent.delta.thinking);
              if (currentContent[index] && currentContent[index].type === "thinking") {
                (currentContent[index] as Anthropic.ThinkingBlock).thinking += messageEvent.delta.thinking;
              }
            } else if (messageEvent.delta.type === "signature_delta") {
              if (currentContent[index] && currentContent[index].type === "thinking") {
                (currentContent[index] as Anthropic.ThinkingBlock).signature = messageEvent.delta.signature;
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
        endThinking();

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
        this.logger.append({ type: "assistant_end", ts: new Date().toISOString() });

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
              const toolUseId = block.id;
              const toolName = block.name;
              const toolInput = block.input;
              const preview = this.tools.get(toolName)?.getPreview?.(toolInput as any);
              this.emit("toolUse", { toolUseId, toolName, input: toolInput, preview });
              const result = await this.executeTool(toolName, toolInput);
              this.emit("toolResult", { toolUseId, toolName, result: result.content, filesChanged: result.filesChanged });
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUseId,
                content: result.content,
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
      const err = error as any;
      this.logger.append({
        type: "error",
        ts: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    } finally {
      setLoading(false);
    }
  }
}

export { Agent };

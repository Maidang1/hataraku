import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";
import {
  Tool,
  bashTool,
  fileReadTool,
  fileEditTool,
  listFilesTool,
  grepTool,
  globTool,
  fetchTool,
  architectTool,
  todoReadTool,
  todoWriteTool,
  SkillsTool,
} from "../../tools";
import { getEffectiveConfig, type McpServerConfig } from "../../config";
import { loadMcpTools } from "../../integrations/mcp";
import { SkillsManager, type SkillLoadOutcome, type SkillMetadata } from "../../integrations/skills";
import { McpDependencyLoader } from "../../integrations/skills/integration/mcp-loader";
import * as os from "os";
import * as path from "path";
import { SafetyPolicy } from "../../policy/safety";
import { SessionLogger, collectEnvSnapshot } from "../../observability/logging";
import type {
  ToolExecutionContext,
  ToolExecutionResult,
} from "../../tools/base";
import { isToolErrorResult } from "../../tools/base";
import { resolveContextSettings, type ResolvedContextSettings } from "../../config/defaults";
import { ContextManager, type TokenCountResult } from "./context-manager";

const HISTORY_TOOL_RESULT_CHAR_LIMIT = 24_000;

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

function isContextOverflowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("context") &&
    (lower.includes("token") || lower.includes("length") || lower.includes("window"))
  );
}

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name.includes("abort") ||
    message.includes("aborted") ||
    message.includes("aborterror") ||
    message.includes("cancelled")
  );
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
  tokenUsage: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => void;
  mcpServerConnectStart: (serverName: string) => void;
  mcpServerConnectSuccess: (serverName: string, toolCount: number) => void;
  mcpServerConnectError: (serverName: string, error: Error) => void;
  mcpReconnectAttempt: (serverName: string, attempt: number, maxRetries: number) => void;
  mcpHealthCheck: (serverName: string, latency: number, healthy: boolean) => void;
  mcpCacheHit: (serverName: string) => void;
  contextCompactionStart: (event: {
    reason: string;
    beforeTokens: number;
    tokenLimit: number;
    messageCount: number;
    estimatedTokens: boolean;
    aggressive: boolean;
  }) => void;
  contextCompactionEnd: (event: {
    reason: string;
    beforeTokens: number;
    afterTokens: number;
    removedMessages: number;
    summaryChars: number;
    estimatedBeforeTokens: boolean;
    estimatedAfterTokens: boolean;
    aggressive: boolean;
  }) => void;
  contextCompactionError: (event: { reason: string; message: string }) => void;
  error: (error: Error) => void;
}

export type AgentRuntimeHooks = {
  onLoadingChange?: (isLoading: boolean) => void;
};

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
  private hooks: AgentRuntimeHooks;
  private currentAbortController: AbortController | null = null;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private contextSettings: ResolvedContextSettings;
  private contextManager: ContextManager;
  private contextCompactionCount = 0;
  private lastCompactionAt?: string;
  private lastCompactionBeforeTokens?: number;
  private lastCompactionAfterTokens?: number;
  private stopRequested = false;
  private disposed = false;

  constructor(params: {
    model: string;
    client?: Anthropic;
    tools?: Map<string, Tool>;
    mcpServers?: Record<string, McpServerConfig>;
    hooks?: AgentRuntimeHooks;
    yolo?: boolean;
  }) {
    const { model, client, tools, mcpServers, hooks, yolo = false } = params;
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
    this.contextSettings = resolveContextSettings(model, config.context);
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
      autoAllowedTools: config.safety?.autoAllowedTools,
      bypassAll: yolo,
    });
    this.logger = new SessionLogger({ sessionId: this.sessionId, projectRoot: this.projectRoot, baseDir });
    this.logger.writeJson("env.json", collectEnvSnapshot(this.projectRoot));

    this.tools.set(fileReadTool.name, fileReadTool);
    this.tools.set(fileEditTool.name, fileEditTool);
    this.tools.set(listFilesTool.name, listFilesTool);
    this.tools.set(grepTool.name, grepTool);
    this.tools.set(globTool.name, globTool);
    this.tools.set(fetchTool.name, fetchTool);
    this.tools.set(architectTool.name, architectTool);
    this.tools.set(todoReadTool.name, todoReadTool);
    this.tools.set(todoWriteTool.name, todoWriteTool);
    this.tools.set(bashTool.name, bashTool);
    const skillsTool = new SkillsTool({
      listSkills: () => this.loadedSkills?.skills ?? [],
      getSkillByName: (name) => this.findSkillByName(name),
      injectSkillDetails: (name, details) => this.injectSkillDetails(name, details),
    });
    this.tools.set(skillsTool.name, skillsTool);
    this.mcpServers = mcpServers ?? config.mcpServers;
    this.hooks = hooks ?? {};
    this.contextManager = new ContextManager({
      client: this.client,
      model: this.model,
      getSystemPrompt: () => this.getSystemPrompt(),
      getToolSchemas: () => this.getToolSchemas(),
      getThinking: () => this.getThinkingConfig(),
      settings: this.contextSettings,
    });
    
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

  /**
   * Get the current token usage statistics.
   */
  getTokenUsage(): { inputTokens: number; outputTokens: number; totalTokens: number } {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
    };
  }

  /**
   * Add a tool to the runtime auto-allowed list.
   * This updates the safety policy for the current session immediately.
   * It also persists the change to the config file for future sessions.
   */
  addAutoAllowedTool(toolName: string): void {
    // Update runtime safety policy (immediate effect in current session)
    this.safety.addAutoAllowedTool(toolName);

    // Persist to config file (for future sessions)
    // Note: This is async but we don't wait for it since the runtime update is sufficient
    import("../../config/loader.js").then(({ addAutoAllowedTool }) => {
      addAutoAllowedTool(toolName);
    });
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

  async getContextState(): Promise<{
    modelContextWindowTokens: number;
    modelAutoCompactTokenLimit: number;
    enableAutoCompact: boolean;
    currentInputTokens: number;
    tokenCountEstimated: boolean;
    historyMessages: number;
    compactionCount: number;
    lastCompactionAt?: string;
    lastCompactionBeforeTokens?: number;
    lastCompactionAfterTokens?: number;
  }> {
    this.contextManager.updateModel(this.model);
    const tokenCount = await this.contextManager.countTokens(this.conversationHistory);
    return {
      modelContextWindowTokens: this.contextSettings.modelContextWindowTokens,
      modelAutoCompactTokenLimit: this.contextSettings.modelAutoCompactTokenLimit,
      enableAutoCompact: this.contextSettings.enableAutoCompact,
      currentInputTokens: tokenCount.inputTokens,
      tokenCountEstimated: tokenCount.estimated,
      historyMessages: this.conversationHistory.length,
      compactionCount: this.contextCompactionCount,
      lastCompactionAt: this.lastCompactionAt,
      lastCompactionBeforeTokens: this.lastCompactionBeforeTokens,
      lastCompactionAfterTokens: this.lastCompactionAfterTokens,
    };
  }

  resetConversation(): void {
    this.conversationHistory = [];
    this.contextCompactionCount = 0;
    this.lastCompactionAt = undefined;
    this.lastCompactionBeforeTokens = undefined;
    this.lastCompactionAfterTokens = undefined;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.emit("tokenUsage", this.getTokenUsage());
  }

  stop(): void {
    this.stopRequested = true;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.logger.append({ type: "stop", ts: new Date().toISOString(), reason: "user_requested" });
    }
  }

  stopCurrentMessage(): void {
    this.stopRequested = true;
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.logger.append({ type: "stop", ts: new Date().toISOString(), reason: "user_requested_message" });
    }
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
        this.mcpServers ?? getEffectiveConfig().mcpServers
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

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.skillsManager.dispose();
    if (this.cleanupMcp) {
      try {
        await this.cleanupMcp();
      } finally {
        this.cleanupMcp = undefined;
        this.mcpLoaded = false;
      }
    }
  }


  private getSystemPrompt(): string {
    let prompt = "You are a helpful coding assistant.\n";
    prompt +=
      "\nYou can use tools to read/search/edit files, manage todos, fetch urls, and run shell commands.\n" +
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

  private getThinkingConfig(): Anthropic.ThinkingConfigParam | undefined {
    if (!this.thinkingEnabled) return undefined;
    return {
      type: "enabled",
      budget_tokens: this.thinkingBudgetTokens,
    } satisfies Anthropic.ThinkingConfigEnabled;
  }

  private async compactHistory(params: {
    reason: string;
    beforeCount: TokenCountResult;
    aggressive?: boolean;
  }): Promise<boolean> {
    if (this.conversationHistory.length < 2) return false;
    const aggressive = params.aggressive ?? false;
    const keepRecentMessages = aggressive
      ? Math.max(2, Math.floor(this.contextSettings.recentMessagesToKeep / 2))
      : this.contextSettings.recentMessagesToKeep;

    this.emit("contextCompactionStart", {
      reason: params.reason,
      beforeTokens: params.beforeCount.inputTokens,
      tokenLimit: this.contextSettings.modelAutoCompactTokenLimit,
      messageCount: this.conversationHistory.length,
      estimatedTokens: params.beforeCount.estimated,
      aggressive,
    });
    this.logger.append({
      type: "context_compaction_start",
      ts: new Date().toISOString(),
      reason: params.reason,
      beforeTokens: params.beforeCount.inputTokens,
      tokenLimit: this.contextSettings.modelAutoCompactTokenLimit,
      messageCount: this.conversationHistory.length,
      aggressive,
    });

    const compacted = await this.contextManager.compactHistory(this.conversationHistory, {
      reason: params.reason,
      keepRecentMessages,
    });
    if (!compacted) return false;

    this.conversationHistory = [
      compacted.summaryMessage,
      ...this.contextManager.sanitizePreservedTail(compacted.preservedTail),
    ];
    const afterCount = await this.contextManager.countTokens(this.conversationHistory);
    this.contextCompactionCount += 1;
    this.lastCompactionAt = new Date().toISOString();
    this.lastCompactionBeforeTokens = params.beforeCount.inputTokens;
    this.lastCompactionAfterTokens = afterCount.inputTokens;

    this.emit("contextCompactionEnd", {
      reason: params.reason,
      beforeTokens: params.beforeCount.inputTokens,
      afterTokens: afterCount.inputTokens,
      removedMessages: compacted.removedMessageCount,
      summaryChars: compacted.summary.length,
      estimatedBeforeTokens: params.beforeCount.estimated,
      estimatedAfterTokens: afterCount.estimated,
      aggressive,
    });
    this.logger.append({
      type: "context_compaction_end",
      ts: this.lastCompactionAt,
      reason: params.reason,
      beforeTokens: params.beforeCount.inputTokens,
      afterTokens: afterCount.inputTokens,
      removedMessages: compacted.removedMessageCount,
      summaryChars: compacted.summary.length,
      aggressive,
    });
    return true;
  }

  async compactNow(params: { reason?: string; aggressive?: boolean } = {}): Promise<{
    compacted: boolean;
    reason: string;
    beforeTokens: number;
    afterTokens: number;
    estimatedBeforeTokens: boolean;
    estimatedAfterTokens: boolean;
  }> {
    this.contextManager.updateModel(this.model);
    const reason = params.reason ?? "manual";
    const beforeCount = await this.contextManager.countTokens(this.conversationHistory);
    let compacted = await this.compactHistory({
      reason,
      beforeCount,
      aggressive: params.aggressive,
    });
    if (!compacted && params.aggressive === undefined) {
      const retryBeforeCount = await this.contextManager.countTokens(this.conversationHistory);
      compacted = await this.compactHistory({
        reason: `${reason}_aggressive`,
        beforeCount: retryBeforeCount,
        aggressive: true,
      });
    }
    const afterCount = await this.contextManager.countTokens(this.conversationHistory);
    return {
      compacted,
      reason,
      beforeTokens: beforeCount.inputTokens,
      afterTokens: afterCount.inputTokens,
      estimatedBeforeTokens: beforeCount.estimated,
      estimatedAfterTokens: afterCount.estimated,
    };
  }

  private async maybeCompactBeforeRequest(reason = "auto_threshold"): Promise<void> {
    this.contextManager.updateModel(this.model);
    const beforeCount = await this.contextManager.countTokens(this.conversationHistory);
    if (!this.contextManager.shouldCompact(beforeCount.inputTokens)) return;
    try {
      await this.compactHistory({ reason, beforeCount });
      const afterCount = await this.contextManager.countTokens(this.conversationHistory);
      if (afterCount.inputTokens >= this.contextSettings.modelAutoCompactTokenLimit) {
        await this.compactHistory({
          reason: `${reason}_aggressive`,
          beforeCount: afterCount,
          aggressive: true,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("contextCompactionError", { reason, message });
      this.logger.append({
        type: "context_compaction_error",
        ts: new Date().toISOString(),
        reason,
        message,
      });
      throw error;
    }
  }

  private normalizeToolResult(result: ToolExecutionResult): { content: string; filesChanged?: string[] } {
    if (typeof result === "string") return { content: result };
    if (isToolErrorResult(result)) {
      return { content: `Error: ${result.message}` };
    }
    return { content: result.content, filesChanged: result.filesChanged };
  }

  private createToolContext(signal?: AbortSignal): ToolExecutionContext {
    return {
      cwd: this.projectRoot,
      signal,
      approvalMode: "default",
      sessionId: this.sessionId,
    };
  }

  private async executeTool(
    toolName: string,
    input: unknown,
    context: ToolExecutionContext,
  ): Promise<{ content: string; filesChanged?: string[] }> {
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
      const raw = await tool.execute(input, context);
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
    const result = await this.executeTool(
      params.toolName,
      params.input,
      this.createToolContext(),
    );
    this.emit("toolResult", {
      toolUseId,
      toolName: params.toolName,
      result: result.content,
      filesChanged: result.filesChanged,
    });
    return result;
  }

  private async executeToolBatch(
    blocks: Anthropic.ToolUseBlock[],
    signal?: AbortSignal,
  ): Promise<Array<{ toolUseId: string; toolName: string; result: { content: string; filesChanged?: string[] } }>> {
    const context = this.createToolContext(signal);
    const allReadonly = blocks.every((block) => this.tools.get(block.name)?.readonly === true);

    if (!allReadonly) {
      const sequentialResults: Array<{ toolUseId: string; toolName: string; result: { content: string; filesChanged?: string[] } }> = [];
      for (const block of blocks) {
        const toolUseId = block.id;
        const toolName = block.name;
        const toolInput = block.input;
        const preview = this.tools.get(toolName)?.getPreview?.(toolInput as any);
        this.emit("toolUse", { toolUseId, toolName, input: toolInput, preview });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const result = await this.executeTool(toolName, toolInput, context);
        this.emit("toolResult", { toolUseId, toolName, result: result.content, filesChanged: result.filesChanged });
        sequentialResults.push({ toolUseId, toolName, result });
      }
      return sequentialResults;
    }

    const concurrentResults = await Promise.all(
      blocks.map(async (block) => {
        const toolUseId = block.id;
        const toolName = block.name;
        const toolInput = block.input;
        const preview = this.tools.get(toolName)?.getPreview?.(toolInput as any);
        this.emit("toolUse", { toolUseId, toolName, input: toolInput, preview });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const result = await this.executeTool(toolName, toolInput, context);
        this.emit("toolResult", { toolUseId, toolName, result: result.content, filesChanged: result.filesChanged });
        return { toolUseId, toolName, result };
      }),
    );
    return concurrentResults;
  }

  async runStream(input: string, signal?: AbortSignal) {
    try {
      this.stopRequested = false;
      this.hooks.onLoadingChange?.(true);
      this.emit("userMessage", { role: "user", content: input });
      this.logger.append({ type: "user_message", ts: new Date().toISOString(), content: input });

      // 添加用户消息到历史
      this.conversationHistory.push({ role: "user", content: input });

      let continueLoop = true;
      this.currentAbortController = new AbortController();
      const combinedSignal = signal ? 
        AbortSignal.any([this.currentAbortController.signal, signal]) : 
        this.currentAbortController.signal;

      while (continueLoop) {
        await this.maybeCompactBeforeRequest();
        this.contextManager.updateModel(this.model);
        const thinking = this.getThinkingConfig();
        let stream: AsyncIterable<Anthropic.MessageStreamEvent>;
        let overflowRetried = false;
        while (true) {
          try {
            stream = await this.client.messages.create({
              max_tokens: this.maxTokens,
              messages: this.conversationHistory,
              model: this.model,
              stream: true,
              system: this.getSystemPrompt(),
              tools: this.getToolSchemas(),
              thinking,
            });
            break;
          } catch (error) {
            if (overflowRetried || !isContextOverflowError(error)) {
              throw error;
            }
            try {
              const beforeOverflowCompact = await this.contextManager.countTokens(this.conversationHistory);
              await this.compactHistory({
                reason: "overflow_retry",
                beforeCount: beforeOverflowCompact,
                aggressive: true,
              });
            } catch (compactError) {
              const message = compactError instanceof Error ? compactError.message : String(compactError);
              this.emit("contextCompactionError", { reason: "overflow_retry", message });
              this.logger.append({
                type: "context_compaction_error",
                ts: new Date().toISOString(),
                reason: "overflow_retry",
                message,
              });
              throw compactError;
            }
            overflowRetried = true;
          }
        }

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

            // Track token usage if provided
            // @ts-ignore - Anthropic SDK types may not include usage in delta
            const usage = messageEvent.delta.usage;
            if (usage) {
              const input_tokens = usage.input_tokens as number | undefined;
              const output_tokens = usage.output_tokens as number | undefined;
              if (input_tokens !== undefined) {
                this.totalInputTokens += input_tokens;
              }
              if (output_tokens !== undefined) {
                this.totalOutputTokens += output_tokens;
              }

              // Emit token usage event for UI updates
              this.emit("tokenUsage", this.getTokenUsage());
            }
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

        if (this.stopRequested || combinedSignal.aborted) {
          continueLoop = false;
          continue;
        }

        // 检查是否需要执行 tool
        const toolUseBlocks = currentContent.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );
        const shouldRunTools = toolUseBlocks.length > 0 || stopReason === "tool_use";

        if (shouldRunTools) {
          if (toolUseBlocks.length === 0) {
            this.logger.append({
              type: "error",
              ts: new Date().toISOString(),
              message: `Stop reason is tool_use but no tool blocks were returned (stopReason=${String(stopReason)})`,
            });
            continueLoop = false;
            continue;
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          const batchResults = await this.executeToolBatch(toolUseBlocks, combinedSignal);
          for (const item of batchResults) {
            toolResults.push({
              type: "tool_result",
              tool_use_id: item.toolUseId,
              content: this.truncateToolResultForHistory(item.result.content),
            });
          }

          // 添加 tool 结果到历史
          this.conversationHistory.push({ role: "user", content: toolResults });
        } else {
          continueLoop = false;
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      this.emit("error", error as Error);
      const err = error as any;
      this.logger.append({
        type: "error",
        ts: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    } finally {
      this.hooks.onLoadingChange?.(false);
      this.currentAbortController = null;
      this.stopRequested = false;
    }
  }

  private truncateToolResultForHistory(content: string): string {
    if (content.length <= HISTORY_TOOL_RESULT_CHAR_LIMIT) return content;
    const head = Math.floor(HISTORY_TOOL_RESULT_CHAR_LIMIT * 0.75);
    const tail = HISTORY_TOOL_RESULT_CHAR_LIMIT - head;
    const omitted = content.length - head - tail;
    return [
      content.slice(0, head),
      `\n...[tool_result truncated for context, omitted ${omitted} chars]...\n`,
      content.slice(content.length - tail),
    ].join("");
  }
}

export { Agent };

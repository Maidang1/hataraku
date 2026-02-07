import path from "path";
import type { SafetyAction, SafetyDecision, SafetyPolicyConfig } from "./types";

function isWithinRoots(targetPath: string, roots: string[]): boolean {
  const resolvedTarget = path.resolve(targetPath);
  return roots.some((root) => {
    const resolvedRoot = path.resolve(root);
    const rel = path.relative(resolvedRoot, resolvedTarget);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
}

function getBashPrefix(command: string): string {
  return command.trim().split(/\s+/).slice(0, 2).join(" ");
}

export class SafetyPolicy {
  private config: SafetyPolicyConfig;
  private runtimeAutoAllowedTools: Set<string> = new Set();

  constructor(config: SafetyPolicyConfig) {
    this.config = config;
    // Initialize with tools from config
    if (config.autoAllowedTools) {
      config.autoAllowedTools.forEach(tool => this.runtimeAutoAllowedTools.add(tool));
    }
  }

  /**
   * Add a tool to the runtime auto-allowed list.
   * This affects the current session immediately.
   */
  addAutoAllowedTool(toolName: string): void {
    this.runtimeAutoAllowedTools.add(toolName);
  }

  /**
   * Check if a tool is in the auto-allowed list.
   */
  isAutoAllowed(toolName: string): boolean {
    return this.runtimeAutoAllowedTools.has(toolName);
  }

  decide(action: SafetyAction): SafetyDecision {
    // YOLO mode: bypass all safety checks
    if (this.config.bypassAll) {
      return { allowed: true, requiresConfirm: false, reason: "YOLO mode: all permissions granted" };
    }

    const projectRoot = this.config.projectRoot;
    const allowedWriteRoots = this.config.allowedWriteRoots?.length
      ? this.config.allowedWriteRoots
      : [projectRoot];
    const autoAllowedTools = this.config.autoAllowedTools ?? [];

    if (action.type === "bash") {
      const prefix = getBashPrefix(action.command);
      const autoPrefixes = this.config.autoAllowedBashPrefixes ?? [
        "rg",
        "cat",
        "ls",
        "pwd",
        "git status",
        "git diff",
        "git log",
      ];

      if (autoPrefixes.some((p) => prefix === p || action.command.trim().startsWith(p + " "))) {
        return { allowed: true, requiresConfirm: false, reason: `Auto-allowed command: ${prefix}` };
      }

      return { allowed: true, requiresConfirm: true, reason: "Command execution requires confirmation" };
    }

    if (action.type === "tool") {
      const toolName = action.toolName;

      // Check if tool is in runtime auto-allowed list (updated during session)
      if (this.runtimeAutoAllowedTools.has(toolName)) {
        return { allowed: true, requiresConfirm: false, reason: `Auto-allowed tool: ${toolName}` };
      }

      if (
        toolName === "fileRead" ||
        toolName === "listFiles" ||
        toolName === "grep" ||
        toolName === "glob" ||
        toolName === "architect" ||
        toolName === "todo_read" ||
        toolName === "skills"
      ) {
        return { allowed: true, requiresConfirm: false, reason: "Read-only tool" };
      }

      if (toolName === "fileEdit" || toolName === "todo_write") {
        const input = action.input as any;
        const filePath =
          typeof input?.path === "string"
            ? input.path
            : typeof input?.filePath === "string"
              ? input.filePath
              : "";
        if (filePath && !isWithinRoots(path.resolve(projectRoot, filePath), allowedWriteRoots)) {
          return {
            allowed: false,
            requiresConfirm: false,
            reason: `Write path is outside allowed roots: ${filePath}`,
          };
        }
        return { allowed: true, requiresConfirm: true, reason: "File write requires confirmation" };
      }

      if (toolName === "fetch") {
        return { allowed: true, requiresConfirm: true, reason: "Network access requires confirmation" };
      }

      if (toolName === "bash") {
        const input = action.input as any;
        const command = typeof input?.command === "string" ? input.command : "";
        return this.decide({ type: "bash", command, preview: action.preview });
      }

      return { allowed: true, requiresConfirm: true, reason: `Tool requires confirmation: ${toolName}` };
    }

    return { allowed: true, requiresConfirm: true, reason: "Unknown action requires confirmation" };
  }
}

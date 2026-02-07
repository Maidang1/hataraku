import type { SkillMetadata } from "../types";
import type { McpServerConfig } from "../../../config";
import type { ResolvedDependencies, Conflict } from "./types";
import { ConflictDetector } from "./conflict-detector";
import { DependencyGraphBuilder } from "./graph";

/**
 * 依赖解析器
 * 解析 Skill 的 MCP 工具依赖
 */
export class DependencyResolver {
  private conflictDetector: ConflictDetector;
  private graphBuilder: DependencyGraphBuilder;

  constructor() {
    this.conflictDetector = new ConflictDetector();
    this.graphBuilder = new DependencyGraphBuilder();
  }

  /**
   * 解析 Skills 的依赖
   */
  resolve(skills: SkillMetadata[]): ResolvedDependencies {
    const mcpServers: Record<string, McpServerConfig> = {};
    const conflicts: Conflict[] = [];
    const warnings: string[] = [];

    // 收集所有 MCP 依赖
    const mcpDependencies: Array<{
      serverName: string;
      skillName: string;
      version?: string;
      url?: string;
      command?: string;
      config?: McpServerConfig;
    }> = [];

    for (const skill of skills) {
      if (skill.dependencies?.tools) {
        for (const toolDep of skill.dependencies.tools) {
          if (toolDep.type === "mcp") {
            mcpDependencies.push({
              serverName: toolDep.value,
              skillName: skill.name,
              version: toolDep.version,
              url: toolDep.url,
              command: toolDep.config?.command,
              config: toolDep.config,
            });
          }
        }
      }
    }

    // 检测版本冲突
    const versionConflicts = this.conflictDetector.detectVersionConflicts(
      mcpDependencies.map((dep) => ({
        serverName: dep.serverName,
        skillName: dep.skillName,
        version: dep.version,
      }))
    );
    conflicts.push(...versionConflicts);

    // 检测配置冲突
    const configConflicts = this.conflictDetector.detectConfigConflicts(
      mcpDependencies.map((dep) => ({
        serverName: dep.serverName,
        skillName: dep.skillName,
        url: dep.url,
        command: dep.command,
      }))
    );
    conflicts.push(...configConflicts);

    // 合并 MCP 服务器配置（去重）
    const serverMap = new Map<string, McpServerConfig>();

    for (const dep of mcpDependencies) {
      if (!serverMap.has(dep.serverName)) {
        // 首次遇到此服务器，使用其配置
        if (dep.config) {
          serverMap.set(dep.serverName, dep.config);
        } else if (dep.url) {
          serverMap.set(dep.serverName, { url: dep.url });
        } else {
          warnings.push(
            `Skill "${dep.skillName}" declares MCP dependency "${dep.serverName}" but provides no configuration`
          );
        }
      } else {
        // 已存在，检查是否有冲突（已在上面检测过）
        // 这里使用优先级策略：保留第一个遇到的配置
        warnings.push(
          `Duplicate MCP server "${dep.serverName}" from skill "${dep.skillName}", using existing configuration`
        );
      }
    }

    // 转换为 Record
    for (const [serverName, config] of serverMap.entries()) {
      mcpServers[serverName] = config;
    }

    // 构建依赖图（用于检测循环依赖）
    const skillDependencies = new Map<string, string[]>();
    for (const skill of skills) {
      const deps: string[] = [];
      if (skill.dependencies?.tools) {
        for (const toolDep of skill.dependencies.tools) {
          if (toolDep.type === "mcp") {
            deps.push(toolDep.value);
          }
        }
      }
      skillDependencies.set(skill.name, deps);
    }

    const graph = this.graphBuilder.buildGraph(skillDependencies);
    if (graph.hasCycle) {
      warnings.push(
        `Circular dependencies detected: ${graph.cycles.map((c) => c.join(" -> ")).join(", ")}`
      );
    }

    return { mcpServers, conflicts, warnings };
  }
}

import type { SkillMetadata } from "../types";
import type { McpServerConfig } from "../../../config";
import { DependencyResolver } from "../dependency/resolver";

/**
 * MCP 依赖加载器
 * 从 Skills 依赖中提取 MCP 服务器配置
 */
export class McpDependencyLoader {
  private resolver: DependencyResolver;

  constructor() {
    this.resolver = new DependencyResolver();
  }

  /**
   * 加载 MCP 依赖
   * 从 Skills 中提取 MCP 服务器配置并合并到全局配置
   */
  loadDependencies(
    skills: SkillMetadata[],
    existingServers?: Record<string, McpServerConfig>
  ): {
    mcpServers: Record<string, McpServerConfig>;
    warnings: string[];
  } {
    // 解析依赖
    const { mcpServers, conflicts, warnings } = this.resolver.resolve(skills);

    // 合并到现有配置
    const merged: Record<string, McpServerConfig> = {
      ...(existingServers ?? {}),
    };

    // 添加从 Skills 中提取的 MCP 服务器
    for (const [serverName, config] of Object.entries(mcpServers)) {
      if (merged[serverName]) {
        // 已存在，检查是否冲突
        const existing = merged[serverName];
        if (
          (existing.url && config.url && existing.url !== config.url) ||
          (existing.command && config.command && existing.command !== config.command)
        ) {
          warnings.push(
            `MCP server "${serverName}" already configured, skipping skill dependency`
          );
        }
      } else {
        // 不存在，添加
        merged[serverName] = config;
      }
    }

    // 报告冲突
    if (conflicts.length > 0) {
      for (const conflict of conflicts) {
        warnings.push(
          `Conflict detected: ${conflict.details}`
        );
      }
    }

    return { mcpServers: merged, warnings };
  }

  /**
   * 验证依赖
   * 检查所有必需的 MCP 依赖是否已配置
   */
  validateDependencies(
    skills: SkillMetadata[],
    availableServers: Record<string, McpServerConfig>
  ): {
    valid: boolean;
    missingDependencies: Array<{ skill: string; server: string }>;
  } {
    const missingDependencies: Array<{ skill: string; server: string }> = [];

    for (const skill of skills) {
      if (skill.dependencies?.tools) {
        for (const toolDep of skill.dependencies.tools) {
          if (toolDep.type === "mcp" && toolDep.required !== false) {
            // 必需的 MCP 依赖
            if (!availableServers[toolDep.value]) {
              missingDependencies.push({
                skill: skill.name,
                server: toolDep.value,
              });
            }
          }
        }
      }
    }

    return {
      valid: missingDependencies.length === 0,
      missingDependencies,
    };
  }
}

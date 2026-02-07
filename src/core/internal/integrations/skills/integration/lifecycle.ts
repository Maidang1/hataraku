import type { SkillMetadata } from "../types";

/**
 * 生命周期管理器
 * 管理 Skills 和 MCP 工具的生命周期
 */
export class LifecycleManager {
  private loadedSkills: Set<string> = new Set();
  private loadedMcpServers: Set<string> = new Set();

  /**
   * 标记 Skill 已加载
   */
  markSkillLoaded(skillName: string): void {
    this.loadedSkills.add(skillName);
  }

  /**
   * 标记 MCP 服务器已加载
   */
  markMcpServerLoaded(serverName: string): void {
    this.loadedMcpServers.add(serverName);
  }

  /**
   * 检查 Skill 是否已加载
   */
  isSkillLoaded(skillName: string): boolean {
    return this.loadedSkills.has(skillName);
  }

  /**
   * 检查 MCP 服务器是否已加载
   */
  isMcpServerLoaded(serverName: string): boolean {
    return this.loadedMcpServers.has(serverName);
  }

  /**
   * 获取已加载的 Skills
   */
  getLoadedSkills(): string[] {
    return Array.from(this.loadedSkills);
  }

  /**
   * 获取已加载的 MCP 服务器
   */
  getLoadedMcpServers(): string[] {
    return Array.from(this.loadedMcpServers);
  }

  /**
   * 卸载 Skill
   */
  unloadSkill(skillName: string): void {
    this.loadedSkills.delete(skillName);
  }

  /**
   * 卸载 MCP 服务器
   */
  unloadMcpServer(serverName: string): void {
    this.loadedMcpServers.delete(serverName);
  }

  /**
   * 清空所有
   */
  clear(): void {
    this.loadedSkills.clear();
    this.loadedMcpServers.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    skillCount: number;
    mcpServerCount: number;
  } {
    return {
      skillCount: this.loadedSkills.size,
      mcpServerCount: this.loadedMcpServers.size,
    };
  }

  /**
   * 验证 Skills 的依赖是否满足
   */
  validateSkillDependencies(
    skills: SkillMetadata[]
  ): {
    valid: boolean;
    missingDependencies: Array<{ skill: string; dependency: string }>;
  } {
    const missingDependencies: Array<{ skill: string; dependency: string }> = [];

    for (const skill of skills) {
      if (skill.dependencies?.tools) {
        for (const toolDep of skill.dependencies.tools) {
          if (toolDep.type === "mcp") {
            // 默认为必需，除非明确设置为 false
            const isRequired = toolDep.required !== false;
            if (isRequired) {
              // 检查 MCP 服务器是否已加载
              if (!this.isMcpServerLoaded(toolDep.value)) {
                missingDependencies.push({
                  skill: skill.name,
                  dependency: toolDep.value,
                });
              }
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

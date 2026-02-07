import type { Conflict } from "./types";

/**
 * 冲突检测器
 * 检测 MCP 工具依赖中的冲突
 */
export class ConflictDetector {
  /**
   * 检测版本冲突
   */
  detectVersionConflicts(
    dependencies: Array<{
      serverName: string;
      skillName: string;
      version?: string;
    }>
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const versionMap = new Map<string, Array<{ skillName: string; version?: string }>>();

    // 按服务器名称分组
    for (const dep of dependencies) {
      if (!versionMap.has(dep.serverName)) {
        versionMap.set(dep.serverName, []);
      }
      versionMap.get(dep.serverName)!.push({
        skillName: dep.skillName,
        version: dep.version,
      });
    }

    // 检查每个服务器的版本冲突
    for (const [serverName, versions] of versionMap.entries()) {
      const uniqueVersions = new Set(
        versions.filter((v) => v.version).map((v) => v.version)
      );

      if (uniqueVersions.size > 1) {
        // 有多个不同的版本要求
        const skills = versions.map((v) => v.skillName);
        for (let i = 0; i < skills.length; i++) {
          for (let j = i + 1; j < skills.length; j++) {
            const v1 = versions[i]?.version;
            const v2 = versions[j]?.version;
            if (v1 && v2 && v1 !== v2) {
              conflicts.push({
                type: "version",
                serverName,
                skill1: skills[i] ?? "",
                skill2: skills[j] ?? "",
                details: `Version conflict: ${skills[i]} requires ${v1}, ${skills[j]} requires ${v2}`,
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * 检测配置冲突
   */
  detectConfigConflicts(
    dependencies: Array<{
      serverName: string;
      skillName: string;
      url?: string;
      command?: string;
    }>
  ): Conflict[] {
    const conflicts: Conflict[] = [];
    const configMap = new Map<
      string,
      Array<{ skillName: string; url?: string; command?: string }>
    >();

    // 按服务器名称分组
    for (const dep of dependencies) {
      if (!configMap.has(dep.serverName)) {
        configMap.set(dep.serverName, []);
      }
      configMap.get(dep.serverName)!.push({
        skillName: dep.skillName,
        url: dep.url,
        command: dep.command,
      });
    }

    // 检查每个服务器的配置冲突
    for (const [serverName, configs] of configMap.entries()) {
      const uniqueUrls = new Set(configs.filter((c) => c.url).map((c) => c.url));
      const uniqueCommands = new Set(
        configs.filter((c) => c.command).map((c) => c.command)
      );

      if (uniqueUrls.size > 1 || uniqueCommands.size > 1) {
        const skills = configs.map((c) => c.skillName);
        for (let i = 0; i < skills.length; i++) {
          for (let j = i + 1; j < skills.length; j++) {
            const c1 = configs[i];
            const c2 = configs[j];
            const skill1 = skills[i];
            const skill2 = skills[j];
            if (
              c1 && c2 && skill1 && skill2 &&
              ((c1.url && c2.url && c1.url !== c2.url) ||
              (c1.command && c2.command && c1.command !== c2.command))
            ) {
              conflicts.push({
                type: "config",
                serverName,
                skill1,
                skill2,
                details: `Config conflict: ${skill1} and ${skill2} specify different configurations for ${serverName}`,
              });
            }
          }
        }
      }
    }

    return conflicts;
  }
}

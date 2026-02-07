/**
 * 工具映射器
 * 将 MCP 工具映射到 Skill 的工具依赖
 */
export class ToolMapper {
  /**
   * 映射工具名称
   * 将 MCP 服务器的工具名称映射为完整的工具名称（serverName.toolName）
   */
  mapToolName(serverName: string, toolName: string): string {
    return `${serverName}.${toolName}`;
  }

  /**
   * 解析工具名称
   * 将完整的工具名称解析为服务器名称和工具名称
   */
  parseToolName(fullToolName: string): { serverName: string; toolName: string } | null {
    const parts = fullToolName.split(".");
    if (parts.length < 2) {
      return null;
    }

    const serverName = parts[0];
    const toolName = parts.slice(1).join(".");

    if (!serverName || !toolName) {
      return null;
    }

    return { serverName, toolName };
  }

  /**
   * 检查工具是否可用
   */
  isToolAvailable(
    toolName: string,
    availableTools: Set<string>
  ): boolean {
    return availableTools.has(toolName);
  }

  /**
   * 获取服务器的所有工具
   */
  getServerTools(
    serverName: string,
    availableTools: Set<string>
  ): string[] {
    const prefix = `${serverName}.`;
    return Array.from(availableTools).filter((tool) =>
      tool.startsWith(prefix)
    );
  }
}

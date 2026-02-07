import type { McpServerConfig } from "../../../config";

/**
 * 工具依赖
 */
export interface ToolDependency {
  type: "mcp" | "builtin";
  value: string; // 工具名称或 MCP 服务器名称
  version?: string; // 版本约束
  required?: boolean; // 是否必需（默认 true）
  url?: string; // MCP 服务器 URL
  config?: McpServerConfig; // MCP 服务器配置
}

/**
 * 依赖冲突
 */
export interface Conflict {
  type: "version" | "config" | "toolName";
  serverName: string;
  skill1: string;
  skill2: string;
  details: string;
}

/**
 * 解析后的依赖
 */
export interface ResolvedDependencies {
  mcpServers: Record<string, McpServerConfig>;
  conflicts: Conflict[];
  warnings: string[];
}

/**
 * 依赖图节点
 */
export interface DependencyNode {
  name: string;
  dependencies: string[];
  dependents: string[];
}

/**
 * 依赖图
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  hasCycle: boolean;
  cycles: string[][];
}

import type { McpServerConfig } from "../../mcp/types";

export enum SkillScope {
  Repo = "Repo",
  User = "User",
  System = "System",
  Admin = "Admin",
}

export interface SkillInterface {
  displayName?: string;
  shortDescription?: string;
  iconSmall?: string;
  iconLarge?: string;
  brandColor?: string;
  defaultPrompt?: string;
}

export interface SkillDependencies {
  tools: SkillToolDependency[];
}

export interface SkillToolDependency {
  type: string;
  value: string;
  description?: string;
  transport?: string;
  command?: string;
  url?: string;
  version?: string; // 版本约束
  required?: boolean; // 是否必需（默认 true）
  config?: McpServerConfig; // MCP 服务器配置
}

export interface SkillMetadata {
  name: string;
  description: string;
  shortDescription?: string;
  interface?: SkillInterface;
  dependencies?: SkillDependencies;
  path: string;
  scope: SkillScope;
  version?: string;
  author?: string;
  tags?: string[];
  enabled?: boolean;
}

export interface SkillError {
  path: string;
  message: string;
}

export interface SkillLoadOutcome {
  skills: SkillMetadata[];
  errors: SkillError[];
  disabledPaths: Set<string>;
}

export interface SkillRoot {
  path: string;
  scope: SkillScope;
}

export interface ScanOptions {
  maxDepth: number;
  maxDirs: number;
  followSymlinks: boolean;
}

export interface ScanResult {
  skillFilePaths: string[];
  truncated: boolean;
}

export interface ParseResult {
  metadata: SkillMetadata;
}

export interface LoadOptions {
  forceReload?: boolean;
  validate?: boolean;
}

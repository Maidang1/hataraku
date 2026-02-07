import yaml from "js-yaml";
import type { SkillMetadata, SkillScope, SkillInterface, SkillDependencies } from "../core/types";
import { SkillParseError } from "../core/errors";
import { readFile, joinPath, dirname } from "../utils/fs";
import { SkillParser } from "./base";

export class MarkdownSkillParser extends SkillParser {
  private readonly metadataDir: string;
  private readonly metadataFile: string;

  constructor(metadataDir: string, metadataFile: string) {
    super();
    this.metadataDir = metadataDir;
    this.metadataFile = metadataFile;
  }

  public canParse(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return ext === "md" || ext === "markdown";
  }

  public parse(filePath: string, scope: SkillScope): SkillMetadata {
    const content = readFile(filePath);
    if (!content) {
      throw new SkillParseError("Failed to read file", filePath);
    }

    const frontmatter = this.extractFrontmatter(content);
    if (!frontmatter) {
      throw new SkillParseError("Missing YAML frontmatter", filePath);
    }

    const parsed: unknown = yaml.load(frontmatter);
    if (!parsed || typeof parsed !== "object") {
      throw new SkillParseError("Invalid YAML frontmatter", filePath);
    }

    const frontmatterData = parsed as Record<string, unknown>;

    if (!frontmatterData.name || !frontmatterData.description) {
      throw new SkillParseError("Missing required fields: name, description", filePath);
    }

    const { interface: asSkillInterface, dependencies } = this.loadSkillMetadata(filePath);

    return {
      name: this.sanitizeSingleLine(String(frontmatterData.name)),
      description: this.sanitizeSingleLine(String(frontmatterData.description)),
      shortDescription: this.extractShortDescription(frontmatterData.metadata),
      interface: asSkillInterface,
      dependencies,
      path: filePath,
      scope,
      version: this.extractString(frontmatterData.version),
      author: this.extractString(frontmatterData.author),
      tags: this.extractTags(frontmatterData.tags),
      enabled: this.extractBoolean(frontmatterData.enabled, true),
    };
  }

  private extractFrontmatter(content: string): string | null {
    const lines = content.split("\n");
    if (lines[0]?.trim() !== "---") {
      return null;
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.trim() === "---") {
        return lines.slice(1, i).join("\n");
      }
    }

    return null;
  }

  private loadSkillMetadata(skillPath: string): {
    interface?: SkillInterface;
    dependencies?: SkillDependencies;
  } {
    const skillDir = dirname(skillPath);
    const metadataPath = joinPath(skillDir, this.metadataDir, this.metadataFile);

    const content = readFile(metadataPath);
    if (!content) {
      return {};
    }

    try {
      const parsed: unknown = yaml.load(content);
      if (!parsed || typeof parsed !== "object") {
        console.warn(`Invalid metadata YAML in ${metadataPath}`);
        return {};
      }

      const data = parsed as Record<string, unknown>;

      return {
        interface: this.resolveInterface(data.interface, skillDir),
        dependencies: this.resolveDependencies(data.dependencies),
      };
    } catch (error) {
      console.warn(`Failed to parse metadata file ${metadataPath}: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  private sanitizeSingleLine(s: string): string {
    return s.replace(/\s+/g, " ").trim();
  }
}

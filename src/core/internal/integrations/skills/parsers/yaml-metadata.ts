import yaml from "js-yaml";
import type { SkillMetadata, SkillScope } from "../core/types";
import { SkillParseError } from "../core/errors";
import { readFile, dirname } from "../utils/fs";
import { SkillParser } from "./base";

export class YamlMetadataParser extends SkillParser {
  public canParse(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return ext === "yaml" || ext === "yml";
  }

  public parse(filePath: string, scope: SkillScope): SkillMetadata {
    const content = readFile(filePath);
    if (!content) {
      throw new SkillParseError("Failed to read file", filePath);
    }

    const parsed: unknown = yaml.load(content);
    if (!parsed || typeof parsed !== "object") {
      throw new SkillParseError("Invalid YAML content", filePath);
    }

    const data = parsed as Record<string, unknown>;

    if (!data.name || !data.description) {
      throw new SkillParseError(
        "Missing required fields: name, description",
        filePath,
      );
    }

    const skillDir = dirname(filePath);

    return {
      name: this.extractString(data.name) ?? "",
      description: this.extractString(data.description) ?? "",
      shortDescription: this.extractShortDescription(data.metadata),
      interface: this.resolveInterface(data.interface, skillDir),
      dependencies: this.resolveDependencies(data.dependencies),
      path: filePath,
      scope,
      version: this.extractString(data.version),
      author: this.extractString(data.author),
      tags: this.extractTags(data.tags),
      enabled: this.extractBoolean(data.enabled, true),
    };
  }
}

import type { SkillScope } from "../core/types";
import type { SkillMetadata } from "../core/types";
import { MarkdownSkillParser } from "./markdown";
import { YamlMetadataParser } from "./yaml-metadata";

export interface ParserConfig {
  metadataDir: string;
  metadataFile: string;
  skillFileName: string;
}

export class ParserFactory {
  private markdownParser: MarkdownSkillParser;
  private yamlParser: YamlMetadataParser;

  constructor(config: ParserConfig) {
    this.markdownParser = new MarkdownSkillParser(
      config.metadataDir,
      config.metadataFile,
    );
    this.yamlParser = new YamlMetadataParser();
  }

  public parse(filePath: string, scope: SkillScope): SkillMetadata {
    const ext = filePath.split(".").pop()?.toLowerCase();

    if (ext === "md" || ext === "markdown") {
      return this.markdownParser.parse(filePath, scope);
    }

    if (ext === "yaml" || ext === "yml") {
      return this.yamlParser.parse(filePath, scope);
    }

    throw new Error(`Unsupported file type: ${ext}`);
  }

  public canParse(filePath: string): boolean {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return ext === "md" || ext === "markdown" || ext === "yaml" || ext === "yml";
  }
}

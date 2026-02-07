import type { SkillMetadata, SkillScope, SkillInterface, SkillDependencies } from "../core/types";
import { joinPath } from "../utils/fs";

export abstract class SkillParser {
  public abstract canParse(filePath: string): boolean;
  public abstract parse(filePath: string, scope: SkillScope): SkillMetadata;

  /**
   * 提取字符串值
   */
  protected extractString(value: unknown): string | undefined {
    if (!value || typeof value !== "string") {
      return undefined;
    }
    return value;
  }

  /**
   * 提取布尔值
   */
  protected extractBoolean(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === "boolean") {
      return value;
    }
    return defaultValue;
  }

  /**
   * 提取标签数组
   */
  protected extractTags(value: unknown): string[] | undefined {
    if (!value || !Array.isArray(value)) {
      return undefined;
    }

    const tags = value
      .map((t) => (typeof t === "string" ? t : undefined))
      .filter((t): t is string => t !== undefined);

    if (tags.length === 0) {
      return undefined;
    }

    return tags;
  }

  /**
   * 解析接口配置
   */
  protected resolveInterface(
    iface: unknown,
    skillDir: string
  ): SkillInterface | undefined {
    if (!iface || typeof iface !== "object") {
      return undefined;
    }

    const data = iface as Record<string, unknown>;

    return {
      displayName: this.extractString(data.display_name),
      shortDescription: this.extractString(data.short_description),
      iconSmall: this.resolveAssetPath(skillDir, data.icon_small),
      iconLarge: this.resolveAssetPath(skillDir, data.icon_large),
      brandColor: this.extractString(data.brand_color),
      defaultPrompt: this.extractString(data.default_prompt),
    };
  }

  /**
   * 解析资源路径
   */
  protected resolveAssetPath(
    skillDir: string,
    assetPath: unknown
  ): string | undefined {
    if (!assetPath || typeof assetPath !== "string") {
      return undefined;
    }
    return joinPath(skillDir, assetPath);
  }

  /**
   * 解析依赖配置
   */
  protected resolveDependencies(deps: unknown): SkillDependencies | undefined {
    if (!deps || typeof deps !== "object") {
      return undefined;
    }

    const data = deps as Record<string, unknown>;
    const tools = data.tools;

    if (!tools || !Array.isArray(tools)) {
      return undefined;
    }

    const toolDeps = tools
      .filter((t): t is Record<string, unknown> => t && typeof t === "object")
      .map((t) => ({
        type: this.extractString(t.type) ?? "",
        value: this.extractString(t.value) ?? "",
        description: this.extractString(t.description),
        transport: this.extractString(t.transport),
        command: this.extractString(t.command),
        url: this.extractString(t.url),
      }))
      .filter((t) => t.type && t.value);

    if (toolDeps.length === 0) {
      return undefined;
    }

    return { tools: toolDeps };
  }

  /**
   * 提取短描述
   */
  protected extractShortDescription(metadata: unknown): string | undefined {
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }

    const data = metadata as Record<string, unknown>;
    const shortDesc = data["short-description"];

    if (!shortDesc || typeof shortDesc !== "string") {
      return undefined;
    }

    return shortDesc.trim();
  }
}

import { DEFAULT_CONFIG } from "./defaults";
import { SkillsConfigSchema, type SkillsConfig } from "./schema";

export type { SkillsConfig };
export { DEFAULT_CONFIG, SkillsConfigSchema };

export class ConfigManager {
  private config: SkillsConfig;

  constructor(partialConfig?: Partial<SkillsConfig>) {
    if (partialConfig) {
      const merged = this.deepMerge(DEFAULT_CONFIG, partialConfig);
      const result = SkillsConfigSchema.safeParse(merged);
      if (result.success) {
        this.config = result.data;
      } else {
        throw new Error(`Invalid config: ${result.error.message}`);
      }
    } else {
      this.config = DEFAULT_CONFIG;
    }
  }

  public get(): Readonly<SkillsConfig> {
    return this.config;
  }

  public update(partialConfig: Partial<SkillsConfig>): void {
    const merged = this.deepMerge(this.config, partialConfig);
    const result = SkillsConfigSchema.safeParse(merged);
    if (result.success) {
      this.config = result.data;
    } else {
      throw new Error(`Invalid config: ${result.error.message}`);
    }
  }

  public getDirectory(key: keyof SkillsConfig["directories"]): string | string[] {
    return this.config.directories[key];
  }

  public getFilename(key: keyof SkillsConfig["filenames"]): string {
    return this.config.filenames[key];
  }

  public getFollowSymlinks(scope: "Repo" | "User" | "System" | "Admin"): boolean {
    const value = this.config.scanning.followSymlinks[scope];
    return value === true;
  }

  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = result[key];
      if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        (result as any)[key] = this.deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        (result as any)[key] = sourceValue;
      }
    }
    return result;
  }
}

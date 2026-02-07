import type { SkillMetadata } from "../core/types";
import { SkillValidationError } from "../core/errors";
import type { Logger } from "../utils/logger";

export class SkillValidator {
  private logger: Logger;
  private enabled: boolean;

  constructor(logger: Logger, enabled: boolean = true) {
    this.logger = logger;
    this.enabled = enabled;
  }

  public validate(metadata: SkillMetadata): boolean {
    if (!this.enabled) {
      return true;
    }

    return this.validateMetadata(metadata);
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private validateMetadata(metadata: SkillMetadata): boolean {
    if (!metadata.name || metadata.name.trim().length === 0) {
      this.logger.error(() => `Skill at ${metadata.path} has empty name`);
      return false;
    }

    if (!metadata.description || metadata.description.trim().length === 0) {
      this.logger.error(() => `Skill at ${metadata.path} has empty description`);
      return false;
    }

    if (!metadata.path || metadata.path.trim().length === 0) {
      this.logger.error(() => `Skill ${metadata.name} has empty path`);
      return false;
    }

    if (metadata.tags) {
      for (const tag of metadata.tags) {
        if (!tag || tag.trim().length === 0) {
          this.logger.warn(() => `Skill ${metadata.name} has empty tag`);
        }
      }
    }

    return true;
  }
}

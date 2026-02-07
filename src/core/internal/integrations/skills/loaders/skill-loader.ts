import { SkillScope, type SkillMetadata, type SkillError } from "../core/types";
import { ParserCoordinator } from "../parsers";
import { ValidationCoordinator } from "../validation";
import type { ParserConfig } from "../parsers/factory";
import type { Logger } from "../utils/logger";

export interface LoaderOptions {
  parserConfig: ParserConfig;
  validationEnabled: boolean;
  skipSystemErrors: boolean;
}

export class SkillLoader {
  private parserCoordinator: ParserCoordinator;
  private validationCoordinator: ValidationCoordinator;
  private logger: Logger;
  private options: LoaderOptions;

  constructor(
    parserCoordinator: ParserCoordinator,
    validationCoordinator: ValidationCoordinator,
    logger: Logger,
    options: LoaderOptions,
  ) {
    this.parserCoordinator = parserCoordinator;
    this.validationCoordinator = validationCoordinator;
    this.logger = logger;
    this.options = options;
  }

  public load(filePath: string, scope: SkillScope): SkillMetadata | null {
    try {
      const metadata = this.parserCoordinator.parse(filePath, scope);

      if (!this.validationCoordinator.validate(metadata)) {
        this.logger.warn(() => `Skill validation failed: ${filePath}`);
        return null;
      }

      if (metadata.enabled === false) {
        this.logger.debug(() => `Skill is disabled: ${filePath}`);
        return null;
      }

      return metadata;
    } catch (error) {
      if (
        this.options.skipSystemErrors &&
        scope === SkillScope.System &&
        !this.validationCoordinator.isEnabled()
      ) {
        return null;
      }

      throw error;
    }
  }

  public loadMultiple(
    filePaths: string[],
    scopes: SkillScope[],
  ): { skills: SkillMetadata[]; errors: SkillError[] } {
    const skills: SkillMetadata[] = [];
    const errors: SkillError[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const scope = scopes[i];

      if (!filePath) {
        continue;
      }

      if (!scope) {
        errors.push({
          path: filePath,
          message: "Missing scope for skill file",
        });
        continue;
      }

      try {
        const skill = this.load(filePath, scope);
        if (skill) {
          skills.push(skill);
        }
      } catch (error) {
        errors.push({
          path: filePath,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { skills, errors };
  }
}

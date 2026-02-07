import type { SkillMetadata, SkillScope } from "../core/types";
import { SkillParseError } from "../core/errors";
import type { ParserConfig } from "./factory";
import { ParserFactory } from "./factory";
import type { Logger } from "../utils/logger";
import type { SkillEventEmitter } from "../core/events";

export class ParserCoordinator {
  private factory: ParserFactory;
  private logger: Logger;
  private eventEmitter: SkillEventEmitter;

  constructor(
    config: ParserConfig,
    logger: Logger,
    eventEmitter: SkillEventEmitter,
  ) {
    this.factory = new ParserFactory(config);
    this.logger = logger;
    this.eventEmitter = eventEmitter;
  }

  public parse(filePath: string, scope: SkillScope): SkillMetadata {
    this.eventEmitter.emit({
      type: "parseStart",
      payload: {
        type: "parseStart",
        filePath,
      },
      timestamp: Date.now(),
    });

    try {
      const metadata = this.factory.parse(filePath, scope);

      this.eventEmitter.emit({
        type: "parseComplete",
        payload: {
          type: "parseComplete",
          filePath,
          skill: metadata,
        },
        timestamp: Date.now(),
      });

      return metadata;
    } catch (error) {
      const parseError = new SkillParseError(
        error instanceof Error ? error.message : "Unknown parse error",
        filePath,
        error,
      );

      this.eventEmitter.emit({
        type: "parseError",
        payload: {
          type: "parseError",
          filePath,
          error: parseError,
        },
        timestamp: Date.now(),
      });

      throw parseError;
    }
  }

  public canParse(filePath: string): boolean {
    return this.factory.canParse(filePath);
  }
}

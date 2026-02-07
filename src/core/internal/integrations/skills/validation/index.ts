import type { SkillMetadata } from "../core/types";
import type { Logger } from "../utils/logger";
import type { SkillEventEmitter } from "../core/events";
import { SkillValidator } from "./skill-validator";

export class ValidationCoordinator {
  private validator: SkillValidator;
  private eventEmitter: SkillEventEmitter;

  constructor(logger: Logger, eventEmitter: SkillEventEmitter, enabled: boolean = true) {
    this.validator = new SkillValidator(logger, enabled);
    this.eventEmitter = eventEmitter;
  }

  public validate(metadata: SkillMetadata): boolean {
    this.eventEmitter.emit({
      type: "validateStart",
      payload: {
        type: "validateStart",
        skillPath: metadata.path,
      },
      timestamp: Date.now(),
    });

    const isValid = this.validator.validate(metadata);

    this.eventEmitter.emit({
      type: "validateComplete",
      payload: {
        type: "validateComplete",
        skillPath: metadata.path,
        isValid,
      },
      timestamp: Date.now(),
    });

    return isValid;
  }

  public isEnabled(): boolean {
    return this.validator.isEnabled();
  }
}

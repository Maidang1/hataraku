export class SkillErrorBase extends Error {
  public override readonly name: string = "SkillErrorBase";
  public readonly path: string;
  public override readonly cause?: unknown;

  constructor(message: string, path: string, cause?: unknown) {
    super(message);
    this.path = path;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SkillLoadError extends SkillErrorBase {
  constructor() {
    super("Failed to load skill", "");
  }
}

export class SkillParseError extends SkillErrorBase {
  constructor(message: string, path: string, cause?: unknown) {
    super(message, path, cause);
  }
}

export class SkillValidationError extends SkillErrorBase {
  constructor(message: string, path: string, cause?: unknown) {
    super(message, path, cause);
  }
}

export class SkillDiscoveryError extends SkillErrorBase {
  constructor(message: string, path: string, cause?: unknown) {
    super(message, path, cause);
  }
}

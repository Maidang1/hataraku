export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export type LogMessage = string | (() => string);

export interface Logger {
  debug(message: LogMessage): void;
  info(message: LogMessage): void;
  warn(message: LogMessage): void;
  error(message: LogMessage): void;
  setLevel(level: LogLevel): void;
  isEnabled(level: LogLevel): boolean;
}

export class DefaultLogger implements Logger {
  private level: LogLevel = LogLevel.INFO;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

    public debug(message: LogMessage): void {
    if (this.isEnabled(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message);
    }
  }

  public info(message: LogMessage): void {
    if (this.isEnabled(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message);
    }
  }

  public warn(message: LogMessage): void {
    if (this.isEnabled(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message);
    }
  }

  public error(message: LogMessage): void {
    if (this.isEnabled(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message);
    }
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public isEnabled(level: LogLevel): boolean {
    return level >= this.level;
  }

  private log(level: LogLevel, message: LogMessage): void {
    const msg = typeof message === "function" ? message() : message;
    const prefix = this.getPrefix(level);
    console.error(`${prefix}${msg}`);
  }

  private getPrefix(level: LogLevel): string {
    const timestamp = new Date().toISOString();
    switch (level) {
      case LogLevel.DEBUG:
        return `[${timestamp}] [DEBUG] `;
      case LogLevel.INFO:
        return `[${timestamp}] [INFO] `;
      case LogLevel.WARN:
        return `[${timestamp}] [WARN] `;
      case LogLevel.ERROR:
        return `[${timestamp}] [ERROR] `;
      default:
        return `[${timestamp}] `;
    }
  }
}

export class NoOpLogger implements Logger {
  public debug(): void {
    // No-op
  }

  public info(): void {
    // No-op
  }

  public warn(): void {
    // No-op
  }

  public error(): void {
    // No-op
  }

  public setLevel(): void {
    // No-op
  }

  public isEnabled(): boolean {
    return false;
  }
}

export const defaultLogger = new DefaultLogger(LogLevel.INFO);
export const noOpLogger = new NoOpLogger();

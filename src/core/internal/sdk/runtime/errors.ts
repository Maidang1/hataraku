export class SdkRuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SdkRuntimeError";
    this.code = code;
  }
}

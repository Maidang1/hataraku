import type { ScanResult } from "../../core/types";
import type { ScanContext } from "../scanner";
import { scanDirectory } from "../scanner";
import type { Logger } from "../../utils/logger";

export class FileSystemDiscoveryStrategy {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public discover(context: ScanContext): ScanResult {
    return scanDirectory(context, context.rootPath);
  }
}

import type { SkillRoot, ScanOptions, ScanResult } from "../core/types";
import type { Logger } from "../utils/logger";
import { resolveRoots } from "./resolver";
import { createScanContext } from "./scanner";
import { FileSystemDiscoveryStrategy } from "./strategies/file-system";
import type { SkillEventEmitter } from "../core/events";

export class DiscoveryCoordinator {
  private logger: Logger;
  private eventEmitter: SkillEventEmitter;

  constructor(logger: Logger, eventEmitter: SkillEventEmitter) {
    this.logger = logger;
    this.eventEmitter = eventEmitter;
  }

  public async discoverFromCwd(
    cwd: string,
    codexHome: string,
    projectMarkers: string[],
    options: ScanOptions,
    skillFileName: string,
  ): Promise<ScanResult> {
    const roots = resolveRoots({
      cwd,
      codexHome,
      projectMarkers,
    });

    // 并行扫描所有根目录
    const results = await Promise.all(
      roots.map((root) => this.discoverFromRoot(root, options, skillFileName))
    );

    // 合并结果
    const allSkillFilePaths: string[] = [];
    let truncated = false;

    for (const result of results) {
      allSkillFilePaths.push(...result.skillFilePaths);
      truncated = truncated || result.truncated;
    }

    return {
      skillFilePaths: allSkillFilePaths,
      truncated,
    };
  }

  private async discoverFromRoot(
    root: SkillRoot,
    options: ScanOptions,
    skillFileName: string,
  ): Promise<ScanResult> {
    const context = createScanContext(options, skillFileName, this.logger);
    context.rootPath = root.path;
    context.followSymlinks = options.followSymlinks;

    this.eventEmitter.emit({
      type: "discoverStart",
      payload: {
        type: "discoverStart",
        rootPath: root.path,
        scope: root.scope,
      },
      timestamp: Date.now(),
    });

    const strategy = new FileSystemDiscoveryStrategy(this.logger);
    const result = strategy.discover(context);

    this.eventEmitter.emit({
      type: "discoverComplete",
      payload: {
        type: "discoverComplete",
        rootPath: root.path,
        scope: root.scope,
        skillCount: result.skillFilePaths.length,
        truncated: result.truncated,
      },
      timestamp: Date.now(),
    });

    return result;
  }

  public resolveRoots(
    cwd: string,
    codexHome: string,
    projectMarkers: string[],
  ): SkillRoot[] {
    return resolveRoots({
      cwd,
      codexHome,
      projectMarkers,
    });
  }
}

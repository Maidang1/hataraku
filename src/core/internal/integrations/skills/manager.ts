import type { SkillLoadOutcome, SkillMetadata } from "./types";
import type { SkillsConfig } from "./config";
import { ConfigManager } from "./config";
import { DiscoveryCoordinator } from "./discovery";
import { ParserCoordinator } from "./parsers";
import { ValidationCoordinator } from "./validation";
import { SkillLoader, type LoaderOptions } from "./loaders";
import { CacheManager } from "./cache";
import { SkillEventEmitter } from "./core/events";
import { DefaultLogger, LogLevel } from "./utils/logger";
import { SkillLoadError } from "./core/errors";
import { SkillScope } from "./core/types";

export class SkillsManager {
  private cacheManager: CacheManager;
  private eventEmitter: SkillEventEmitter;
  private logger: DefaultLogger;
  private configManager: ConfigManager;
  private config: SkillsConfig;

  constructor(codexHome: string, config?: Partial<SkillsConfig>) {
    this.configManager = new ConfigManager(config);
    this.config = this.configManager.get();

    this.logger = new DefaultLogger(LogLevel.INFO);
    this.eventEmitter = new SkillEventEmitter();
    this.cacheManager = new CacheManager(this.config.cache.ttl, this.config.cache.enabled);
  }

  public async getSkillsForCwd(cwd: string, forceReload: boolean = false): Promise<SkillLoadOutcome> {
    if (!forceReload && this.cacheManager.has(cwd)) {
      const cached = this.cacheManager.get(cwd);
      if (cached) {
        return cached;
      }
    }

    this.eventEmitter.emit({
      type: "loadStart",
      payload: {
        type: "loadStart",
        cwd,
        roots: [],
      },
      timestamp: Date.now(),
    });

    try {
      const outcome = await this.loadSkills(cwd);
      this.cacheManager.set(cwd, outcome);

      this.eventEmitter.emit({
        type: "loadComplete",
        payload: {
          type: "loadComplete",
          cwd,
          skillCount: outcome.skills.length,
          errorCount: outcome.errors.length,
        },
        timestamp: Date.now(),
      });

      return outcome;
    } catch (error) {
      const loadError = new SkillLoadError();
      this.eventEmitter.emit({
        type: "loadError",
        payload: {
          type: "loadError",
          cwd,
          error: loadError,
        },
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  public clearCache(): void {
    this.cacheManager.clear();
  }

  public getEventEmitter(): SkillEventEmitter {
    return this.eventEmitter;
  }

  private async loadSkills(cwd: string): Promise<SkillLoadOutcome> {
    const discoveryCoordinator = new DiscoveryCoordinator(this.logger, this.eventEmitter);
    const parserCoordinator = new ParserCoordinator(
      {
        metadataDir: this.config.filenames.metadataDir,
        metadataFile: this.config.filenames.metadataFile,
        skillFileName: this.config.filenames.skillFile,
      },
      this.logger,
      this.eventEmitter,
    );
    const validationCoordinator = new ValidationCoordinator(
      this.logger,
      this.eventEmitter,
      this.config.validation.enabled,
    );

    const loaderOptions: LoaderOptions = {
      parserConfig: {
        metadataDir: this.config.filenames.metadataDir,
        metadataFile: this.config.filenames.metadataFile,
        skillFileName: this.config.filenames.skillFile,
      },
      validationEnabled: this.config.validation.enabled,
      skipSystemErrors: true,
    };

    const loader = new SkillLoader(
      parserCoordinator,
      validationCoordinator,
      this.logger,
      loaderOptions,
    );

    const scanResult = await discoveryCoordinator.discoverFromCwd(
      cwd,
      this.config.directories.homeDir,
      this.config.directories.projectMarker,
      {
        maxDepth: this.config.scanning.maxDepth,
        maxDirs: this.config.scanning.maxDirsPerRoot,
        followSymlinks: true,
      },
      this.config.filenames.skillFile,
    );

    const roots = discoveryCoordinator.resolveRoots(
      cwd,
      this.config.directories.homeDir,
      this.config.directories.projectMarker,
    );

    const scopesMap = new Map<string, SkillScope>();
    for (const root of roots) {
      for (const skillPath of scanResult.skillFilePaths) {
        if (skillPath.startsWith(root.path)) {
          scopesMap.set(skillPath, root.scope);
        }
      }
    }

    const scopes: SkillScope[] = [];
    for (const path of scanResult.skillFilePaths) {
      const scope = scopesMap.get(path);
      if (scope) {
        scopes.push(scope);
      }
    }

    const result = loader.loadMultiple(scanResult.skillFilePaths, scopes);

    const skills = this.deduplicateAndSort(result.skills);

    return {
      skills,
      errors: result.errors,
      disabledPaths: new Set(),
    };
  }

  private deduplicateAndSort(skills: SkillMetadata[]): SkillMetadata[] {
    const seen = new Set<string>();
    const filtered = skills.filter((skill) => {
      if (seen.has(skill.path)) return false;
      seen.add(skill.path);
      return true;
    });

    filtered.sort((a, b) => {
      const rankDiff = this.scopeRank(a.scope) - this.scopeRank(b.scope);
      if (rankDiff !== 0) return rankDiff;
      const nameDiff = a.name.localeCompare(b.name);
      if (nameDiff !== 0) return nameDiff;
      return a.path.localeCompare(b.path);
    });

    return filtered;
  }

  private scopeRank(scope: SkillScope): number {
    switch (scope) {
      case SkillScope.Repo:
        return 0;
      case SkillScope.User:
        return 1;
      case SkillScope.System:
        return 2;
      case SkillScope.Admin:
        return 3;
      default:
        return 4;
    }
  }
}

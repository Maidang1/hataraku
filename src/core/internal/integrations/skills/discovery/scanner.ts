import path from "path";
import type { ScanOptions, ScanResult } from "../core/types";
import { resolveRealPath } from "../utils/path";
import { isDirectory, readDirectory, resolveSymlinkTarget } from "../utils/fs";
import type { Logger } from "../utils/logger";

export interface ScanContext {
  rootPath: string;
  maxDepth: number;
  maxDirs: number;
  followSymlinks: boolean;
  skillFileName: string;
  logger: Logger;
}

interface ScanQueueItem {
  path: string;
  depth: number;
}

export function scanDirectory(context: ScanContext, targetPath: string): ScanResult {
  const { rootPath, maxDepth, maxDirs, followSymlinks, skillFileName, logger } = context;

  const resolvedRoot = resolveRealPath(rootPath);
  if (!resolvedRoot || !isDirectory(resolvedRoot)) {
    return { skillFilePaths: [], truncated: false };
  }

  const resolvedTarget = resolveRealPath(targetPath);
  if (!resolvedTarget) {
    return { skillFilePaths: [], truncated: false };
  }

  const queue: ScanQueueItem[] = [{ path: resolvedTarget, depth: 0 }];
  const visitedDirs = new Set<string>();
  visitedDirs.add(resolvedTarget);
  const skillFilePaths: string[] = [];

  while (queue.length > 0) {
    const { path: currentPath, depth } = queue.shift()!;

    const entries = readDirectory(currentPath);

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);

      if (entry.isSymbolicLink()) {
        if (!followSymlinks) {
          continue;
        }
        const resolvedPath = resolveSymlinkTarget(fullPath);
        if (resolvedPath) {
          enqueueDir(queue, visitedDirs, resolvedPath, depth + 1, maxDepth);
        }
        continue;
      }

      if (entry.isDirectory()) {
        const resolvedPath = resolveRealPath(fullPath);
        if (resolvedPath) {
          enqueueDir(queue, visitedDirs, resolvedPath, depth + 1, maxDepth);
        }
        continue;
      }

      if (entry.isFile() && entry.name === skillFileName) {
        skillFilePaths.push(fullPath);
      }
    }

    if (visitedDirs.size >= maxDirs) {
      logger.warn(() =>
        `Scan truncated at ${rootPath}: reached max directories (${maxDirs})`
      );
      return { skillFilePaths, truncated: true };
    }
  }

  return { skillFilePaths, truncated: false };
}

function enqueueDir(
  queue: ScanQueueItem[],
  visited: Set<string>,
  dir: string,
  depth: number,
  maxDepth: number,
): void {
  if (depth > maxDepth) {
    return;
  }
  if (visited.has(dir)) {
    return;
  }
  visited.add(dir);
  queue.push({ path: dir, depth });
}

export function createScanContext(
  options: ScanOptions,
  skillFileName: string,
  logger: Logger,
): ScanContext {
  return {
    rootPath: "", // Will be set during scan
    maxDepth: options.maxDepth,
    maxDirs: options.maxDirs,
    followSymlinks: options.followSymlinks,
    skillFileName,
    logger,
  };
}

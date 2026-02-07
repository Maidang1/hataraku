import fs from "fs";
import path from "path";

export function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function readDirectory(dirPath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function joinPath(...parts: string[]): string {
  return path.join(...parts);
}

export function dirname(filePath: string): string {
  return path.dirname(filePath);
}

export function resolveSymlinkTarget(symlinkPath: string): string | null {
  try {
    const resolved = fs.realpathSync(symlinkPath);
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      return resolved;
    }
    return null;
  } catch {
    return null;
  }
}

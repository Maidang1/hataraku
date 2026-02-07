import path from "path";
import fs from "fs";

export function resolveRealPath(filePath: string): string | null {
  try {
    return fs.realpathSync(filePath);
  } catch {
    return null;
  }
}

export function resolveProjectRoot(cwd: string, markers: string[]): string | null {
  let current = cwd;
  const resolved = resolveRealPath(current);
  if (resolved) {
    current = resolved;
  }

  while (true) {
    if (markers.some((marker) => fs.existsSync(path.join(current, marker)))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

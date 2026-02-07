import path from "path";

export function resolveFrom(root: string, target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(root, target);
}

export function isWithin(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

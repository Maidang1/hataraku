import crypto from "crypto";
import path from "path";

type CacheEntry = { contentHash: string };

const readCache = new Map<string, CacheEntry>();

function normalize(filePath: string): string {
  return path.resolve(filePath);
}

export function noteFileReadForEdit(filePath: string, content: string): void {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  readCache.set(normalize(filePath), { contentHash: hash });
}

export function hasMatchingReadContext(filePath: string, content: string): boolean {
  const currentHash = crypto.createHash("sha256").update(content).digest("hex");
  const entry = readCache.get(normalize(filePath));
  return Boolean(entry && entry.contentHash === currentHash);
}

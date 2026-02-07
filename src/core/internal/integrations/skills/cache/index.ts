import type { ICache } from "./interface";
import type { SkillLoadOutcome } from "../core/types";
import { MemoryCache } from "./memory-cache";

export type { ICache };
export { MemoryCache };

export class CacheManager {
  private cache: ICache;

  constructor(ttl: number = 300000, enabled: boolean = true) {
    this.cache = new MemoryCache(ttl, enabled);
  }

  public get(key: string): SkillLoadOutcome | null {
    return this.cache.get(key);
  }

  public set(key: string, value: SkillLoadOutcome): void {
    this.cache.set(key, value);
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public setCache(cache: ICache): void {
    this.cache = cache;
  }
}

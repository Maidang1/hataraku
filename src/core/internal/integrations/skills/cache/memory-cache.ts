import type { ICache } from "./interface";
import type { SkillLoadOutcome } from "../core/types";

const DEFAULT_CLEANUP_INTERVAL_MS = 60000;

interface CacheEntry {
  value: SkillLoadOutcome;
  expiresAt: number;
}

export class MemoryCache implements ICache {
  private cache: Map<string, CacheEntry>;
  private ttl: number;
  private enabled: boolean;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(ttl: number = 300000, enabled: boolean = true) {
    this.cache = new Map();
    this.ttl = ttl;
    this.enabled = enabled;
    this.startCleanup();
  }

  public get(key: string): SkillLoadOutcome | null {
    if (!this.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  public set(key: string, value: SkillLoadOutcome): void {
    if (!this.enabled) {
      return;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  public has(key: string): boolean {
    if (!this.enabled) {
      return false;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public size(): number {
    return this.cache.size;
  }

  public clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 启动定时清理过期缓存
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.clearExpired();
    }, DEFAULT_CLEANUP_INTERVAL_MS);
  }

  /**
   * 停止定时清理
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

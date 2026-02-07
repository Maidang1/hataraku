import type { SkillLoadOutcome } from "../core/types";

export interface ICache {
  get(key: string): SkillLoadOutcome | null;
  set(key: string, value: SkillLoadOutcome): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
}

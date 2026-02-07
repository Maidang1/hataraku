import type { SkillMetadata, SkillScope } from "./types";
import type { SkillErrorBase } from "./errors";

export type SkillEventType =
  | "loadStart"
  | "loadComplete"
  | "loadError"
  | "discoverStart"
  | "discoverComplete"
  | "discoverError"
  | "parseStart"
  | "parseComplete"
  | "parseError"
  | "validateStart"
  | "validateComplete"
  | "validateError";

export type SkillEventPayload =
  | LoadStartPayload
  | LoadCompletePayload
  | LoadErrorPayload
  | DiscoverStartPayload
  | DiscoverCompletePayload
  | DiscoverErrorPayload
  | ParseStartPayload
  | ParseCompletePayload
  | ParseErrorPayload
  | ValidateStartPayload
  | ValidateCompletePayload
  | ValidateErrorPayload;

export interface LoadStartPayload {
  type: "loadStart";
  cwd: string;
  roots: string[];
}

export interface LoadCompletePayload {
  type: "loadComplete";
  cwd: string;
  skillCount: number;
  errorCount: number;
}

export interface LoadErrorPayload {
  type: "loadError";
  cwd: string;
  error: SkillErrorBase;
}

export interface DiscoverStartPayload {
  type: "discoverStart";
  rootPath: string;
  scope: SkillScope;
}

export interface DiscoverCompletePayload {
  type: "discoverComplete";
  rootPath: string;
  scope: SkillScope;
  skillCount: number;
  truncated: boolean;
}

export interface DiscoverErrorPayload {
  type: "discoverError";
  rootPath: string;
  scope: SkillScope;
  error: SkillErrorBase;
}

export interface ParseStartPayload {
  type: "parseStart";
  filePath: string;
}

export interface ParseCompletePayload {
  type: "parseComplete";
  filePath: string;
  skill: SkillMetadata;
}

export interface ParseErrorPayload {
  type: "parseError";
  filePath: string;
  error: SkillErrorBase;
}

export interface ValidateStartPayload {
  type: "validateStart";
  skillPath: string;
}

export interface ValidateCompletePayload {
  type: "validateComplete";
  skillPath: string;
  isValid: boolean;
}

export interface ValidateErrorPayload {
  type: "validateError";
  skillPath: string;
  error: SkillErrorBase;
}

export interface SkillEvent {
  type: SkillEventType;
  payload: SkillEventPayload;
  timestamp: number;
}

export type SkillEventListener = (event: SkillEvent) => void;

export class SkillEventEmitter {
  private listeners: Map<SkillEventType, Set<SkillEventListener>> = new Map();

  public on(eventType: SkillEventType, listener: SkillEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  public off(eventType: SkillEventType, listener: SkillEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  public emit(event: SkillEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

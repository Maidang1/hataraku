import { atom } from "jotai";
import { globalStore } from "./store";

export type UiMode = "composer" | "activity" | "conversation";
export type UiSeverity = "info" | "warn" | "error";

type BaseEvent = {
  id: string;
  ts: string;
  expanded?: boolean;
  summary?: string;
  severity?: UiSeverity;
  startedAt?: string;
  endedAt?: string;
  pinned?: boolean;
};

export type ChatEvent = BaseEvent & {
  type: "chat";
  role: "user" | "assistant" | "system";
  content: string;
};

export type ThinkingEvent = BaseEvent & {
  type: "thinking";
  content: string;
  redacted?: boolean;
};

export type ToolEvent = BaseEvent & {
  type: "tool";
  toolUseId: string;
  toolName: string;
  status: "pending" | "done";
  preview?: string;
  input?: unknown;
  result?: string;
  filesChanged?: string[];
};

export type ConfirmEvent = BaseEvent & {
  type: "confirm";
  confirmId: string;
  toolName: string;
  reason: string;
  preview?: string;
  resolved?: boolean;
  allowed?: boolean;
};

export type McpEvent = BaseEvent & {
  type: "mcp";
  message: string;
  level?: UiSeverity;
};

export type ErrorEvent = BaseEvent & {
  type: "error";
  message: string;
  stack?: string;
};

export type UiEvent = ChatEvent | ThinkingEvent | ToolEvent | ConfirmEvent | McpEvent | ErrorEvent;

export const eventsAtom = atom<UiEvent[]>([]);

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clearEvents(): void {
  globalStore.set(eventsAtom, []);
}

export function addEvent(event: UiEvent): void {
  updateEvents((current) => [...current, event]);
}

function updateEvents(updater: (events: UiEvent[]) => UiEvent[]): void {
  const current = globalStore.get(eventsAtom);
  globalStore.set(eventsAtom, updater(current));
}

function appendEventContent(type: "chat" | "thinking", params: { id: string; delta: string }): void {
  updateEvents((current) =>
    current.map((event) => {
      if (event.type !== type) return event;
      if (event.id !== params.id) return event;
      return { ...event, content: event.content + params.delta };
    }),
  );
}

export function addChatEvent(params: { role: ChatEvent["role"]; content: string; id?: string }): string {
  const id = params.id ?? newId("chat");
  addEvent({ id, ts: nowIso(), type: "chat", role: params.role, content: params.content });
  return id;
}

export function appendChatContent(params: { id: string; delta: string }): void {
  appendEventContent("chat", params);
}

export function addThinkingEvent(params: { content: string; id?: string; redacted?: boolean }): string {
  const id = params.id ?? newId("thinking");
  addEvent({ id, ts: nowIso(), type: "thinking", content: params.content, redacted: params.redacted });
  return id;
}

export function appendThinkingContent(params: { id: string; delta: string }): void {
  appendEventContent("thinking", params);
}

export function addToolEvent(params: {
  toolUseId: string;
  toolName: string;
  input?: unknown;
  preview?: string;
}): string {
  const id = newId("tool");
  const startedAt = nowIso();
  addEvent({
    id,
    ts: startedAt,
    type: "tool",
    toolUseId: params.toolUseId,
    toolName: params.toolName,
    status: "pending",
    input: params.input,
    preview: params.preview,
    summary: params.preview || `Run ${params.toolName}`,
    severity: "info",
    expanded: false,
    startedAt,
  });
  return id;
}

export function completeToolEvent(params: {
  toolUseId: string;
  result: string;
  filesChanged?: string[];
}): void {
  updateEvents((current) =>
    current.map((event) => {
      if (event.type !== "tool") return event;
      if (event.toolUseId !== params.toolUseId) return event;
      const endedAt = nowIso();
      return {
        ...event,
        status: "done" as const,
        result: params.result,
        filesChanged: params.filesChanged,
        endedAt,
        summary: params.result || event.summary,
        severity: (params.result.startsWith("Error:") ? "error" : "info") as UiSeverity,
      };
    }),
  );
}

export function addConfirmEvent(params: {
  confirmId: string;
  toolName: string;
  reason: string;
  preview?: string;
}): string {
  const id = newId("confirm");
  addEvent({
    id,
    ts: nowIso(),
    type: "confirm",
    confirmId: params.confirmId,
    toolName: params.toolName,
    reason: params.reason,
    preview: params.preview,
    resolved: false,
    summary: `${params.toolName}: ${params.reason}`,
    severity: "warn",
    pinned: true,
    expanded: false,
  });
  return id;
}

export function resolveConfirmEvent(params: { confirmId: string; allowed: boolean }): void {
  updateEvents((current) =>
    current.map((event) => {
      if (event.type !== "confirm") return event;
      if (event.confirmId !== params.confirmId) return event;
      return {
        ...event,
        resolved: true,
        allowed: params.allowed,
        pinned: false,
        severity: (params.allowed ? "info" : "error") as UiSeverity,
        summary: `${event.toolName} ${params.allowed ? "allowed" : "denied"}`,
      };
    }),
  );
}

export function addMcpEvent(message: string, level: McpEvent["level"] = "info"): void {
  addEvent({
    id: newId("mcp"),
    ts: nowIso(),
    type: "mcp",
    message,
    level,
    summary: message,
    severity: level,
  });
}

export function addErrorEvent(params: { message: string; stack?: string }): void {
  addEvent({
    id: newId("error"),
    ts: nowIso(),
    type: "error",
    message: params.message,
    stack: params.stack,
    summary: params.message,
    severity: "error",
    expanded: true,
  });
}

export function toggleExpanded(eventId: string): void {
  updateEvents((current) =>
    current.map((event) => {
      if (event.id !== eventId) return event;
      return { ...event, expanded: !event.expanded };
    }),
  );
}

function parseTs(value: string): number {
  return Date.parse(value);
}

function byTimeDesc(a: UiEvent, b: UiEvent): number {
  return parseTs(b.ts) - parseTs(a.ts);
}

function parseMcpServerKey(message: string): string {
  const trimmed = message.trim();
  const match = trimmed.match(/^[^:]+:\s(.+?)(?:\s\(|\s—|$)/);
  if (match?.[1]) {
    return match[1];
  }
  return trimmed;
}

export function getConversationEvents(events: UiEvent[]): ChatEvent[] {
  return events.filter((event): event is ChatEvent => event.type === "chat");
}

export function getActivityEvents(events: UiEvent[]): Array<ToolEvent | ConfirmEvent | McpEvent | ErrorEvent> {
  const activity = events.filter(
    (event): event is ToolEvent | ConfirmEvent | McpEvent | ErrorEvent =>
      event.type === "tool" || event.type === "confirm" || event.type === "mcp" || event.type === "error",
  );

  const dedupedMcp: Array<ToolEvent | ConfirmEvent | McpEvent | ErrorEvent> = [];
  const latestInfoByServer = new Map<string, McpEvent>();

  for (const event of activity) {
    if (event.type !== "mcp" || event.level !== "info") {
      dedupedMcp.push(event);
      continue;
    }
    const server = parseMcpServerKey(event.message);
    const existing = latestInfoByServer.get(server);
    if (!existing || parseTs(event.ts) > parseTs(existing.ts)) {
      latestInfoByServer.set(server, event);
    }
  }

  for (const event of latestInfoByServer.values()) {
    dedupedMcp.push(event);
  }

  const pinned = dedupedMcp.filter((event) => event.pinned).sort(byTimeDesc);
  const normal = dedupedMcp.filter((event) => !event.pinned).sort(byTimeDesc);
  return [...pinned, ...normal];
}

export function getPendingConfirmCount(events: UiEvent[]): number {
  return events.filter((event) => event.type === "confirm" && !event.resolved).length;
}

export function getLatestToolEvent(events: UiEvent[]): ToolEvent | null {
  const toolEvents = events.filter((event): event is ToolEvent => event.type === "tool");
  if (!toolEvents.length) return null;
  return toolEvents.sort(byTimeDesc)[0] ?? null;
}

export function getActiveToolCount(events: UiEvent[]): number {
  return events.filter((event) => event.type === "tool" && event.status === "pending").length;
}

export function getLatestError(events: UiEvent[]): ErrorEvent | null {
  const errorEvents = events.filter((event): event is ErrorEvent => event.type === "error");
  if (!errorEvents.length) return null;
  return errorEvents.sort(byTimeDesc)[0] ?? null;
}

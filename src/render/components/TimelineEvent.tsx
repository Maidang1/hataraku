import React from "react";
import { Box, Text } from "ink";
import { MarkdownText } from "./MarkdownText";
import { Spinner } from "./Spinner";
import type { ChatEvent, ConfirmEvent, ErrorEvent, McpEvent, ThinkingEvent, ToolEvent, UiEvent } from "../state/events";
import { COLORS } from "../theme";

const GENERIC_COMMAND_CONFIRM_REASON = "Command execution requires confirmation";

function formatConfirmReason(reason: string): string {
  if (reason === GENERIC_COMMAND_CONFIRM_REASON) {
    return "Needs approval";
  }
  return reason;
}

function formatConfirmPreview(preview?: string): string | undefined {
  if (!preview) return undefined;
  const normalized = preview.trim();
  if (!normalized) return undefined;

  if (normalized.startsWith("Run command:")) {
    const command = normalized.slice("Run command:".length).trim().replace(/\s*\n\s*/g, " ");
    return command ? `cmd: ${command}` : undefined;
  }

  return normalized.replace(/\s*\n\s*/g, " ");
}

function ChatEventRow(props: { event: ChatEvent }): React.JSX.Element {
  const { event } = props;

  if (event.role === "user") {
    const lines = (event.content ?? "").split("\n");
    return (
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, i) => (
          <Box key={i}>
            <Text color="white" bold>❯ </Text>
            <Text backgroundColor={COLORS.bgSelected} color="white">
              {" "}
              {line || " "}
              {" "}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }

  if (event.role === "system") {
    const lines = (event.content ?? "").split("\n");
    return (
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, i) => (
          <Box key={i}>
            <Text color="white">{line || " "}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="white">● </Text>
        <MarkdownText content={event.content ?? ""} />
      </Box>
    </Box>
  );
}

function ToolEventRow(props: { event: ToolEvent }): React.JSX.Element {
  const { event } = props;
  const statusIcon = event.status === "done" ? "✓" : "⟳";
  const statusColor = event.status === "done" ? COLORS.success : COLORS.pending;
  const preview = event.preview ?? `Run ${event.toolName}`;
  const duration =
    event.startedAt && event.endedAt
      ? `${Math.max(1, Math.round((Date.parse(event.endedAt) - Date.parse(event.startedAt)) / 1000))}s`
      : undefined;

  if (!event.expanded) {
    return (
      <Box marginBottom={0}>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color={COLORS.accent} bold>{event.toolName}</Text>
        <Text color={COLORS.muted}> {preview}</Text>
        {duration && <Text color={COLORS.dim}> ({duration})</Text>}
        {event.status === "pending" && <Text color={COLORS.pending}> <Spinner /></Text>}
      </Box>
    );
  }

  const resultPreview = event.result
    ? event.result.length > 500
      ? event.result.slice(0, 500) + "…"
      : event.result
    : undefined;

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color={COLORS.accent} bold>{event.toolName}</Text>
        {duration && <Text color={COLORS.dim}> ({duration})</Text>}
      </Box>
      {event.input !== undefined && (
        <Box paddingLeft={2}>
          <Text color={COLORS.muted}>{typeof event.input === "string" ? event.input : JSON.stringify(event.input, null, 2)}</Text>
        </Box>
      )}
      {resultPreview && (
        <Box paddingLeft={2} flexDirection="column">
          <Text color={COLORS.dim}>{resultPreview}</Text>
        </Box>
      )}
      {!!event.filesChanged?.length && (
        <Box paddingLeft={2} flexDirection="column">
          {event.filesChanged.map((filePath) => (
            <Text key={filePath} color={COLORS.success}>  ✎ {filePath}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ThinkingEventRow(props: { event: ThinkingEvent }): React.JSX.Element {
  const { event } = props;
  const lines = event.redacted ? ["[thinking is redacted]"] : (event.content ?? "").split("\n");
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={COLORS.dim}>… thinking</Text>
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        {lines.map((line, i) => (
          <Text key={i} color={COLORS.dim}>{line || " "}</Text>
        ))}
      </Box>
    </Box>
  );
}

function ConfirmEventRow(props: {
  event: ConfirmEvent;
  isActive: boolean;
}): React.JSX.Element {
  const { event, isActive } = props;
  const reason = formatConfirmReason(event.reason);
  const preview = formatConfirmPreview(event.preview);
  const showReason = !(event.reason === GENERIC_COMMAND_CONFIRM_REASON && preview);

  if (event.resolved) {
    const icon = event.allowed ? "✓" : "✗";
    const color = event.allowed ? COLORS.success : COLORS.danger;
    const label = event.allowed ? "allowed" : "denied";
    return (
      <Box marginBottom={0}>
        <Text color={color}>{icon} </Text>
        <Text color={COLORS.muted}>{event.toolName} — {label}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box>
        <Text color={COLORS.warning} bold>⚠ Confirm </Text>
        <Text color={COLORS.text} bold>{event.toolName}</Text>
      </Box>
      {showReason && (
        <Box paddingLeft={2}>
          <Text color={COLORS.muted}>{reason}</Text>
        </Box>
      )}
      {preview && (
        <Box paddingLeft={2}>
          <Text color={COLORS.dim}>{preview}</Text>
        </Box>
      )}
      {isActive && (
        <Box paddingTop={1}>
          <Text color={COLORS.warning}>
            <Text bold color={COLORS.text}>↑/↓</Text> select, <Text bold color={COLORS.text}>Enter</Text> confirm, <Text bold color={COLORS.text}>Esc</Text> deny
          </Text>
        </Box>
      )}
    </Box>
  );
}

function McpEventRow(props: { event: McpEvent }): React.JSX.Element {
  const { event } = props;
  const color = event.level === "error" ? COLORS.danger : event.level === "warn" ? COLORS.warning : COLORS.dim;

  return (
    <Box marginBottom={0}>
      <Text color={color}>🔌 {event.message}</Text>
    </Box>
  );
}

function ErrorEventRow(props: { event: ErrorEvent }): React.JSX.Element {
  const { event } = props;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={COLORS.danger}>✗ Error: {event.message}</Text>
      {event.expanded && event.stack && (
        <Box paddingLeft={2}>
          <Text color={COLORS.errorMuted}>{event.stack}</Text>
        </Box>
      )}
    </Box>
  );
}

export function TimelineEvent(props: {
  event: UiEvent;
  activeConfirmId: string | null;
}): React.JSX.Element | null {
  const { event, activeConfirmId } = props;

  switch (event.type) {
    case "chat":
      return <ChatEventRow event={event} />;
    case "thinking":
      return <ThinkingEventRow event={event} />;
    case "tool":
      return <ToolEventRow event={event} />;
    case "confirm":
      return <ConfirmEventRow event={event} isActive={event.confirmId === activeConfirmId} />;
    case "mcp":
      return <McpEventRow event={event} />;
    case "error":
      return <ErrorEventRow event={event} />;
    default:
      return null;
  }
}

import React from "react";
import { Box, Text } from "ink";
import { MarkdownText } from "./MarkdownText";
import { Spinner } from "./Spinner";
import {
  formatConfirmPreview,
  formatConfirmReason,
  shouldShowConfirmReason,
} from "./formatters/confirm";
import type {
  ChatEvent,
  ConfirmEvent,
  ErrorEvent,
  McpEvent,
  ThinkingEvent,
  ToolEvent,
  UiEvent,
} from "../state/events";
import { COLORS, INDENT, SPACE, TEXT } from "../theme";

const TOOL_RESULT_PREVIEW_MAX = 400;
const TOOL_META_PREVIEW_MAX = 56;

type EventHeaderProps = {
  icon: string;
  iconColor: string;
  title: string;
  titleColor?: string;
  meta?: string;
  trailing?: React.ReactNode;
};

function EventHeader({
  icon,
  iconColor,
  title,
  titleColor = TEXT.primary,
  meta,
  trailing,
}: EventHeaderProps): React.JSX.Element {
  return (
    <Box>
      <Text color={iconColor}>{icon} </Text>
      <Text color={titleColor} bold>
        {title}
      </Text>
      {meta && <Text color={TEXT.dim}> {meta}</Text>}
      {trailing ? <Text color={TEXT.dim}> {trailing}</Text> : null}
    </Box>
  );
}

function EventBody(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingLeft={INDENT.sm} marginTop={SPACE.xs}>
      {props.children}
    </Box>
  );
}

function EventHint(props: { text: string }): React.JSX.Element {
  return (
    <Box paddingLeft={INDENT.sm}>
      <Text color={TEXT.dim}>{props.text}</Text>
    </Box>
  );
}

function oneLine(input: string, limit: number): string {
  const normalized = input.replace(/\s*\n\s*/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, Math.max(1, limit - 1)) + "…";
}

function durationMeta(event: ToolEvent): string | undefined {
  if (!event.startedAt || !event.endedAt) return undefined;
  const sec = Math.max(
    1,
    Math.round((Date.parse(event.endedAt) - Date.parse(event.startedAt)) / 1000),
  );
  return `(${sec}s)`;
}

function ChatEventRow(props: { event: ChatEvent }): React.JSX.Element {
  const { event } = props;

  if (event.role === "user") {
    return (
      <Box flexDirection="column" marginBottom={SPACE.sm}>
        <Box>
          <Text color={COLORS.info}>❯ </Text>
          {(event.content ?? "").split("\n").map((line, index) => (
            <Text key={`${event.id}-user-${index}`} color={TEXT.primary}>
              {line || " "}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  if (event.role === "system") {
    return (
      <Box flexDirection="column" marginBottom={SPACE.sm}>
        <Box>
          <Text color={COLORS.warning}>◆ </Text>
          {(event.content ?? "").split("\n").map((line, index) => (
            <Text key={`${event.id}-sys-${index}`} color={TEXT.secondary}>
              {line || " "}
            </Text>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={SPACE.sm}>
      <Box>
        <Text color={COLORS.accent}>● </Text>
        <MarkdownText content={event.content ?? ""} />
      </Box>
    </Box>
  );
}

function ToolEventRow(props: { event: ToolEvent }): React.JSX.Element {
  const { event } = props;
  const isDone = event.status === "done";
  const statusIcon = isDone ? "●" : "●";
  const statusColor = isDone ? COLORS.accent : COLORS.pending;
  const preview = oneLine(event.preview ?? `Run ${event.toolName}`, TOOL_META_PREVIEW_MAX);

  const resultPreview = event.result
    ? oneLine(event.result, TOOL_RESULT_PREVIEW_MAX)
    : undefined;

  return (
    <Box flexDirection="column" marginBottom={SPACE.sm}>
      {/* Tool header with tree-style prefix */}
      <Box>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color={COLORS.accent} bold>{event.toolName}</Text>
        {isDone && <Text color={TEXT.dim}> {durationMeta(event)}</Text>}
        {!isDone && (
          <>
            <Text color={TEXT.dim}> </Text>
            <Spinner />
          </>
        )}
      </Box>

      {/* Tree-style nested content */}
      {!event.expanded && (
        <Box paddingLeft={INDENT.sm}>
          <Text color={TEXT.dim}>└ </Text>
          <Text color={TEXT.muted}>{preview}</Text>
        </Box>
      )}

      {event.expanded && (
        <Box flexDirection="column" paddingLeft={INDENT.sm}>
          {event.input !== undefined && (
            <Box>
              <Text color={TEXT.dim}>├ </Text>
              <Text color={TEXT.muted}>
                {typeof event.input === "string" ? event.input : JSON.stringify(event.input, null, 2)}
              </Text>
            </Box>
          )}
          {resultPreview && (
            <Box>
              <Text color={TEXT.dim}>├ </Text>
              <Text color={TEXT.dim}>{resultPreview}</Text>
            </Box>
          )}
          {!!event.filesChanged?.length &&
            event.filesChanged.map((filePath, idx) => (
              <Box key={`${event.id}-${filePath}`}>
                <Text color={TEXT.dim}>{idx === event.filesChanged!.length - 1 ? "└ " : "├ "}</Text>
                <Text color={COLORS.success}>✎ {filePath}</Text>
              </Box>
            ))}
        </Box>
      )}
    </Box>
  );
}

function ThinkingEventRow(props: { event: ThinkingEvent }): React.JSX.Element {
  const { event } = props;
  const content = event.redacted ? "[thinking is redacted]" : event.content ?? "";

  return (
    <Box flexDirection="column" marginBottom={SPACE.sm}>
      <EventHeader icon="…" iconColor={TEXT.dim} title="thinking" titleColor={TEXT.dim} />
      <EventBody>
        {(content || "").split("\n").map((line, index) => (
          <Text key={`${event.id}-thinking-${index}`} color={TEXT.dim}>
            {line || " "}
          </Text>
        ))}
      </EventBody>
    </Box>
  );
}

function ConfirmEventRow(props: {
  event: ConfirmEvent;
  isActive: boolean;
}): React.JSX.Element | null {
  const { event, isActive } = props;
  if (!event.resolved && isActive) {
    return null;
  }

  const preview = formatConfirmPreview(event.preview);
  const reason = formatConfirmReason(event.reason);
  const showReason = shouldShowConfirmReason(event.reason, event.preview);

  if (event.resolved) {
    const allowed = !!event.allowed;
    return (
      <Box flexDirection="column" marginBottom={SPACE.sm}>
        <EventHeader
          icon={allowed ? "✓" : "✗"}
          iconColor={allowed ? COLORS.success : COLORS.danger}
          title={`Confirm ${allowed ? "allowed" : "denied"}`}
          titleColor={TEXT.secondary}
          meta={event.toolName}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={SPACE.sm}>
      <EventHeader
        icon="⚠"
        iconColor={COLORS.warning}
        title={`Confirm ${event.toolName}`}
        titleColor={TEXT.primary}
      />
      <EventBody>
        {showReason && <Text color={TEXT.muted}>{reason}</Text>}
        {preview && <Text color={TEXT.dim}>{preview}</Text>}
      </EventBody>
      {isActive && (
        <EventHint text="↑/↓ select • Enter confirm • Esc deny" />
      )}
    </Box>
  );
}

function McpEventRow(props: { event: McpEvent }): React.JSX.Element {
  const { event } = props;
  const color =
    event.level === "error"
      ? COLORS.danger
      : event.level === "warn"
        ? COLORS.warning
        : TEXT.dim;
  const message = oneLine(event.message, 120);

  return (
    <Box flexDirection="column" marginBottom={SPACE.sm}>
      <EventHeader icon="*" iconColor={color} title={message} titleColor={color} />
    </Box>
  );
}

function ErrorEventRow(props: { event: ErrorEvent }): React.JSX.Element {
  const { event } = props;

  return (
    <Box flexDirection="column" marginBottom={SPACE.sm}>
      <EventHeader icon="✗" iconColor={COLORS.danger} title="Error" titleColor={COLORS.danger} meta={oneLine(event.message, 100)} />
      {event.expanded && event.stack && (
        <EventBody>
          <Text color={COLORS.errorMuted}>{event.stack}</Text>
        </EventBody>
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
      return (
        <ConfirmEventRow
          event={event}
          isActive={event.confirmId === activeConfirmId}
        />
      );
    case "mcp":
      return <McpEventRow event={event} />;
    case "error":
      return <ErrorEventRow event={event} />;
    default:
      return null;
  }
}

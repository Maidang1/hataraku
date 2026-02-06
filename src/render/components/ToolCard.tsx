import React from "react";
import { Box, Text } from "ink";
import type { ToolEvent } from "../state/events";
import { COLORS } from "../theme";

function stringify(input: unknown): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function truncateLines(value: string, maxLines: number): { text: string; truncated: boolean } {
  const lines = value.split("\n");
  if (lines.length <= maxLines) return { text: value, truncated: false };
  return { text: lines.slice(0, maxLines).join("\n") + "\n…", truncated: true };
}

// Simple JSON syntax highlighting
function highlightJson(json: string): React.ReactNode {
  return json.split(/(".*?"|\{|\}|\[|\]|:|,|\n)/).map((part, i) => {
    if (part.match(/^".*?"$/)) {
      return <Text key={i} color={COLORS.success}>{part}</Text>;
    }
    if (part.match(/^[{}\[\]]$/)) {
      return <Text key={i} color={COLORS.accent}>{part}</Text>;
    }
    if (part === ':') {
      return <Text key={i} color={COLORS.text}>{part}</Text>;
    }
    return <Text key={i} color={COLORS.muted}>{part}</Text>;
  });
}

export function ToolCard(props: {
  event: ToolEvent;
  selected: boolean;
  focused: boolean;
}): React.JSX.Element {
  const { event, selected, focused } = props;
  const isSelected = selected && focused;
  const statusLabel = event.status === "done" ? "done" : "pending";
  const statusColor = event.status === "done" ? COLORS.success : COLORS.pending;
  const bgColor = isSelected ? COLORS.bgSelected : event.status === "done" ? COLORS.bgToolDone : COLORS.bgToolRunning;
  const summary = event.summary ?? event.preview ?? (event.input ? truncateLines(stringify(event.input), 3).text : "(no input)");
  const selectedPrefix = isSelected ? "▶ " : "";
  const duration =
    event.startedAt && event.endedAt
      ? `${Math.max(0, Date.parse(event.endedAt) - Date.parse(event.startedAt))}ms`
      : event.status === "pending"
        ? "running"
        : undefined;

  if (!event.expanded) {
    return (
      <Box backgroundColor={bgColor}>
        <Text dimColor color={isSelected ? COLORS.focus : COLORS.dim}>
          {selectedPrefix}🔧 {event.toolName}
        </Text>
        <Text color={statusColor}> [{statusLabel}]</Text>
        {duration && <Text color={COLORS.muted}> ({duration})</Text>}
        <Text color={COLORS.muted}> — {summary}</Text>
      </Box>
    );
  }

  const borderColor = isSelected ? COLORS.focus : COLORS.border;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} paddingLeft={1} paddingRight={1} backgroundColor={bgColor}>
      <Box justifyContent="space-between">
        <Text bold color={COLORS.text}>
          {selectedPrefix}🔧 {event.toolName}
        </Text>
        <Text color={statusColor}>
          {statusLabel}
          {duration ? ` • ${duration}` : ""}
        </Text>
      </Box>

      {summary && (
        <Box>
          <Text color={COLORS.muted}>{summary}</Text>
        </Box>
      )}

      {event.input !== undefined && (
        <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
          <Text bold color={COLORS.accent}>Input</Text>
          <Box paddingLeft={2} paddingY={1}>
            {highlightJson(stringify(event.input))}
          </Box>
        </Box>
      )}

      {event.result !== undefined && (
        <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
          <Text bold color={COLORS.accent}>Result</Text>
          <Box paddingLeft={2} paddingY={1}>
            <Text dimColor color={COLORS.dim}>{event.result || "(empty)"}</Text>
          </Box>
        </Box>
      )}

      {!!event.filesChanged?.length && (
        <Box flexDirection="column" paddingTop={1} paddingBottom={1}>
          <Text bold color={COLORS.accent}>Files Changed</Text>
          <Box paddingLeft={1}>
            {event.filesChanged.map((f) => (
              <Text key={f} dimColor color={COLORS.dim}>
                • {f}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      <Box paddingTop={1}>
        <Text dimColor color={COLORS.muted}>
          Enter/e: toggle details • i: back to input
        </Text>
      </Box>
    </Box>
  );
}

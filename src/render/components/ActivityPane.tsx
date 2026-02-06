import React from "react";
import { Box, Text } from "ink";
import type { ConfirmEvent, ErrorEvent, McpEvent, ToolEvent } from "../state/events";
import { COLORS } from "../theme";
import { ConfirmCard } from "./ConfirmCard";
import { ToolCard } from "./ToolCard";

type ActivityEvent = ToolEvent | ConfirmEvent | McpEvent | ErrorEvent;

function mcpColor(level: McpEvent["level"]): string {
  if (level === "error") return COLORS.danger;
  if (level === "warn") return COLORS.warning;
  return COLORS.dim;
}

export function ActivityPane(props: {
  events: ActivityEvent[];
  selectedEventId: string | null;
  focused: boolean;
}): React.JSX.Element {
  const { events, selectedEventId, focused } = props;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={focused ? COLORS.focus : COLORS.border} paddingX={1}>
      <Box paddingBottom={1}>
        <Text bold color={focused ? COLORS.focus : COLORS.accent}>
          Activity
        </Text>
      </Box>
      {events.length === 0 && <Text dimColor color={COLORS.dim}>No activity yet.</Text>}
      {events.map((event) => {
        const selected = selectedEventId === event.id;
        if (event.type === "tool") {
          return <ToolCard key={event.id} event={event} selected={selected} focused={focused} />;
        }
        if (event.type === "confirm") {
          return <ConfirmCard key={event.id} event={event} selected={selected} focused={focused} />;
        }
        if (event.type === "mcp") {
          return (
            <Box key={event.id}>
              <Text color={selected && focused ? COLORS.focus : mcpColor(event.level)}>
                {selected && focused ? "▶ " : ""}🔌 {event.summary ?? event.message}
              </Text>
            </Box>
          );
        }
        return (
          <Box key={event.id} flexDirection="column">
            <Text color={selected && focused ? COLORS.focus : COLORS.danger}>
              {selected && focused ? "▶ " : ""}
              Error: {event.message}
            </Text>
            {event.expanded && event.stack && (
              <Box paddingLeft={2}>
                <Text dimColor color={COLORS.errorMuted}>
                  {event.stack}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

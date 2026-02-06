import React from "react";
import { Box, Text } from "ink";
import type { UiEvent } from "../state/events";
import { ChatBubble } from "./ChatBubble";
import { ToolCard } from "./ToolCard";
import { ConfirmCard } from "./ConfirmCard";
import { COLORS } from "../theme";

export function Timeline(props: {
  events: UiEvent[];
  mode: "composer" | "activity" | "conversation";
  selectedEventId: string | null;
}): React.JSX.Element {
  const { events, mode, selectedEventId } = props;
  const focused = mode === "activity";

  return (
    <Box flexDirection="column">
      {events.map((event) => {
        const selected = selectedEventId === event.id;
        if (event.type === "chat") return <ChatBubble key={event.id} event={event} />;
        if (event.type === "tool") return <ToolCard key={event.id} event={event} selected={selected} focused={focused} />;
        if (event.type === "confirm") return <ConfirmCard key={event.id} event={event} selected={selected} focused={focused} />;
        if (event.type === "mcp") {
          return (
            <Box key={event.id}>
              <Text dimColor color={COLORS.dim}>
                {selected && mode === "activity" ? "▶ " : ""}
                🔌 {event.message}
              </Text>
            </Box>
          );
        }
        if (event.type === "error") {
          return (
            <Box key={event.id} flexDirection="column">
              <Text color={COLORS.danger}>
                {selected && mode === "activity" ? "▶ " : ""}
                Error: {event.message}
              </Text>
              {event.expanded && event.stack && (
                <Box paddingLeft={2}>
                  <Text dimColor color={COLORS.muted}>
                    {event.stack}
                  </Text>
                </Box>
              )}
            </Box>
          );
        }
        return null;
      })}
    </Box>
  );
}

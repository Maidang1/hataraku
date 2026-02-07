import React from "react";
import { Box, Text } from "ink";
import { VirtualList } from "ink-virtual-list";
import type { UiEvent } from "../state/events";
import { TimelineEvent } from "./TimelineEvent";
import { COLORS } from "../theme";

export function EventTimeline(props: {
  events: UiEvent[];
  hiddenEventCount: number;
  activeConfirmId: string | null;
}): React.JSX.Element {
  const { events, hiddenEventCount, activeConfirmId } = props;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {hiddenEventCount > 0 && (
        <Box marginBottom={1}>
          <Text color={COLORS.dim}>… {hiddenEventCount} earlier events hidden</Text>
        </Box>
      )}
      <VirtualList
        items={events}
        height="auto"
        reservedLines={hiddenEventCount > 0 ? 1 : 0}
        keyExtractor={(event) => event.id}
        renderItem={({ item }) => (
          <TimelineEvent
            event={item}
            activeConfirmId={activeConfirmId}
          />
        )}
      />
    </Box>
  );
}

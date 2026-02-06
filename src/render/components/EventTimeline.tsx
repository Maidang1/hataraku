import React from "react";
import { Box } from "ink";
import type { UiEvent } from "../state/events";
import { TimelineEvent } from "./TimelineEvent";

export function EventTimeline(props: {
  events: UiEvent[];
  hiddenEventCount: number;
  activeConfirmId: string | null;
}): React.JSX.Element {
  const { events, activeConfirmId } = props;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {events.map((event) => (
        <TimelineEvent
          key={event.id}
          event={event}
          activeConfirmId={activeConfirmId}
        />
      ))}
    </Box>
  );
}

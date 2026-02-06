import React from "react";
import { Box, Text } from "ink";
import type { ConfirmEvent } from "../state/events";
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

type ConfirmStatus = {
  label: "allowed" | "denied" | "pending";
  color: string;
};

function getConfirmStatus(event: ConfirmEvent): ConfirmStatus {
  if (event.resolved !== true) {
    return { label: "pending", color: COLORS.pending };
  }

  if (event.allowed) {
    return { label: "allowed", color: COLORS.success };
  }

  return { label: "denied", color: COLORS.danger };
}

function getConfirmBgColor(event: ConfirmEvent, selected: boolean, focused: boolean): string {
  if (selected && focused) {
    return COLORS.bgSelected;
  }

  if (event.resolved === true) {
    return COLORS.bgConfirmResolved;
  }

  return COLORS.bgConfirmPending;
}

export function ConfirmCard(props: {
  event: ConfirmEvent;
  selected: boolean;
  focused: boolean;
}): React.JSX.Element {
  const { event, selected, focused } = props;
  const selectedPrefix = selected && focused ? "▶ " : "";
  const status = getConfirmStatus(event);
  const reason = formatConfirmReason(event.reason);
  const preview = formatConfirmPreview(event.preview);
  const showReason = !(event.reason === GENERIC_COMMAND_CONFIRM_REASON && preview);
  const summary = event.summary ?? `${event.toolName}: ${preview ?? reason}`;

  // Background color for visual hierarchy
  const bgColor = getConfirmBgColor(event, selected, focused);

  if (!event.expanded) {
    return (
      <Box backgroundColor={bgColor}>
        <Text color={selected && focused ? COLORS.focus : COLORS.warning}>
          {selectedPrefix}⚠ Confirm{" "}
        </Text>
        <Text color={status.color}>[{status.label}]</Text>
        <Text color={COLORS.muted}> — {summary}</Text>
      </Box>
    );
  }

  const borderColor = selected && focused ? COLORS.warning : COLORS.border;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} paddingX={1} backgroundColor={bgColor}>
      <Box justifyContent="space-between">
        <Text bold color={COLORS.text}>
          {selectedPrefix}Confirm tool execution
        </Text>
        <Text color={status.color}>{status.label}</Text>
      </Box>

      <Box flexDirection="column">
        <Text color={COLORS.muted}>
          Tool: {event.toolName}{showReason ? ` • ${reason}` : ""}
        </Text>
        {preview && (
          <Box paddingTop={1}>
            <Text dimColor color={COLORS.dim}>{preview}</Text>
          </Box>
        )}
      </Box>

      <Box paddingTop={1} flexDirection="column">
        <Text color={COLORS.muted}>
          <Text bold color={COLORS.text}>↑/↓</Text> select, <Text bold color={COLORS.text}>Enter</Text> confirm, <Text bold color={COLORS.text}>Esc</Text> deny.
        </Text>
        <Text dimColor color={COLORS.dim}>
          Enter/e: toggle details
        </Text>
      </Box>
    </Box>
  );
}

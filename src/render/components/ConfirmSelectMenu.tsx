import React from "react";
import { Box, Text } from "ink";
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

export type ConfirmSelectOption = {
  key: "allow" | "deny";
  label: string;
  description: string;
};

export function ConfirmSelectMenu(props: {
  toolName: string;
  reason: string;
  preview?: string;
  options: ConfirmSelectOption[];
  selectedIndex: number;
}): React.JSX.Element {
  const { toolName, reason, preview, options, selectedIndex } = props;
  const conciseReason = formatConfirmReason(reason);
  const concisePreview = formatConfirmPreview(preview);
  const showReason = !(reason === GENERIC_COMMAND_CONFIRM_REASON && concisePreview);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={COLORS.warning}
      marginBottom={0}
      paddingY={0}
    >
      <Box paddingX={1}>
        <Text color={COLORS.warning} bold>⚠ Permission request</Text>
        <Text color={COLORS.muted}> for </Text>
        <Text color={COLORS.text} bold>{toolName}</Text>
      </Box>
      {showReason && (
        <Box paddingX={1}>
          <Text color={COLORS.muted}>{conciseReason}</Text>
        </Box>
      )}
      {concisePreview && (
        <Box paddingX={1}>
          <Text color={COLORS.dim} dimColor>{concisePreview}</Text>
        </Box>
      )}
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const color = option.key === "allow" ? COLORS.success : COLORS.danger;
        return (
          <Box key={option.key} paddingX={1}>
            <Text color={isSelected ? COLORS.focus : COLORS.muted} backgroundColor={isSelected ? COLORS.bgSelected : undefined}>
              {isSelected ? "› " : "  "}
            </Text>
            <Text color={isSelected ? color : COLORS.textSoft} backgroundColor={isSelected ? COLORS.bgSelected : undefined} bold={isSelected}>
              {option.label}
            </Text>
            <Text color={isSelected ? COLORS.text : COLORS.muted} backgroundColor={isSelected ? COLORS.bgSelected : undefined}>
              {" "}
              {option.description}
            </Text>
          </Box>
        );
      })}
      <Box paddingX={1}>
        <Text color={COLORS.muted}>
          <Text bold color={COLORS.text}>↑/↓</Text> select, <Text bold color={COLORS.text}>Enter</Text> confirm, <Text bold color={COLORS.text}>Esc</Text> deny.
        </Text>
      </Box>
    </Box>
  );
}

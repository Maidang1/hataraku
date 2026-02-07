import React from "react";
import { Box, Text } from "ink";
import type { SlashCommandMeta } from "../commands";
import { COLORS } from "../theme";

function truncateText(value: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (value.length <= maxWidth) return value;
  if (maxWidth <= 3) return ".".repeat(maxWidth);
  return `${value.slice(0, maxWidth - 3)}...`;
}

function getSlashNeedle(query: string): string {
  const trimmed = query.trim();
  if (!trimmed.startsWith("/")) return "";
  return trimmed.slice(1).trim().split(/\s+/)[0] ?? "";
}

export function SlashCommandMenu(props: {
  commands: SlashCommandMeta[];
  selectedIndex: number;
  query: string;
  terminalColumns: number;
}): React.JSX.Element {
  const { commands, selectedIndex, query, terminalColumns } = props;
  const needle = getSlashNeedle(query);
  const nameWidth = Math.max(12, Math.min(28, Math.floor(terminalColumns * 0.28)));
  const descriptionWidth = Math.max(20, terminalColumns - nameWidth - 6);

  return (
    <Box
      flexDirection="column"
      marginBottom={0}
      paddingY={0}
    >
      <Box paddingX={1}>
        <Text color={COLORS.muted}>
          slash commands{needle ? ` matching "${needle}"` : ""}
        </Text>
      </Box>
      {commands.map((command, index) => {
        const isSelected = index === selectedIndex;
        const usage = command.usage ? ` ${command.usage}` : "";
        const nameText = truncateText(`/${command.name}${usage}`, nameWidth);
        const descriptionText = truncateText(command.description, descriptionWidth);

        return (
          <Box key={command.name} paddingX={1}>
            <Text
              color={isSelected ? COLORS.focus : COLORS.textSoft}
              backgroundColor={isSelected ? COLORS.bgSelected : undefined}
            >
              {isSelected ? "› " : "  "}
              {nameText.padEnd(nameWidth)}
            </Text>
            <Text
              color={isSelected ? COLORS.text : COLORS.muted}
              backgroundColor={isSelected ? COLORS.bgSelected : undefined}
            >
              {" "}
              {descriptionText}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

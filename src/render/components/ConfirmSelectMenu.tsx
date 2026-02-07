import React from "react";
import { Box, Text } from "ink";
import { COLORS } from "../theme";

export type ConfirmSelectOption = {
  key: "allow" | "deny" | "allowAlways";
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
  const { toolName, options, selectedIndex } = props;

  return (
    <Box
      flexDirection="column"
      marginBottom={0}
      paddingY={0}
    >
      <Box paddingX={1}>
        <Text color={COLORS.warning} bold>⚠ Permission request</Text>
        <Text color={COLORS.muted}> for </Text>
        <Text color={COLORS.text} bold>{toolName}</Text>
      </Box>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const color = (option.key === "allow" || option.key === "allowAlways") ? COLORS.success : COLORS.danger;
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

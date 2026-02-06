import React from "react";
import { Box, Text } from "ink";
import { COLORS } from "../theme";

export function StatusBar(props: {
  model: string;
  cwd: string;
  terminalColumns: number;
  pendingConfirms: number;
  activeTools: number;
  latestTool: string;
  thinking: boolean;
  thinkingModeEnabled: boolean;
}): React.JSX.Element {
  const { model, cwd, terminalColumns, pendingConfirms, activeTools, latestTool, thinking, thinkingModeEnabled } = props;
  const isCompact = terminalColumns < 100;
  const isMinimal = terminalColumns < 72;

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={COLORS.border}
      paddingTop={0}
      marginTop={0}
    >
      <Box>
        <Text color={COLORS.accent} bold>{model}</Text>
        {!isCompact && (
          <Text color={COLORS.dim}> | {cwd}</Text>
        )}
      </Box>

      <Box>
        <>
          <Text color={COLORS.dim}>thinking mode </Text>
          <Text color={thinkingModeEnabled ? COLORS.success : COLORS.muted} bold>
            {thinkingModeEnabled ? "on" : "off"}
          </Text>
          {!isMinimal && <Text color={COLORS.muted}> (Shift+Tab)</Text>}
          <Text color={COLORS.muted}> · </Text>
        </>

        {thinking && (
          <>
            <Text color={COLORS.pending}>⚡ thinking</Text>
            <Text color={COLORS.muted}> · </Text>
          </>
        )}

        {activeTools > 0 && (
          <>
            <Text color={COLORS.accent}>🔧 {activeTools}</Text>
            {!isMinimal && latestTool && <Text color={COLORS.muted}> {latestTool}</Text>}
            <Text color={COLORS.muted}> · </Text>
          </>
        )}

        {pendingConfirms > 0 && (
          <>
            <Text color={COLORS.warning}>⚠ {pendingConfirms}</Text>
            <Text color={COLORS.muted}> · </Text>
          </>
        )}

        <Text dimColor color={COLORS.dim}>{isMinimal ? "/help" : "/help for commands"}</Text>
      </Box>
    </Box>
  );
}

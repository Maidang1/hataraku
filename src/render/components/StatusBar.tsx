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
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
}): React.JSX.Element {
  const {
    model,
    cwd,
    terminalColumns,
    pendingConfirms,
    activeTools,
    latestTool,
    thinking,
    thinkingModeEnabled,
    tokenUsage,
  } = props;

  const isCompact = terminalColumns < 100;
  const isMinimal = terminalColumns < 72;
  const separatorLine = "─".repeat(Math.max(8, terminalColumns - 2));

  // Format token count for display
  const formatTokens = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const hasTokenUsage = tokenUsage.totalTokens > 0;

  return (
    <Box flexDirection="column" marginTop={0}>
      <Text color={COLORS.border}>{separatorLine}</Text>
      <Box flexDirection="row" justifyContent="space-between">
        <Box>
          <Text color={COLORS.accent} bold>
            {model}
          </Text>
          {!isCompact && <Text color={COLORS.dim}> | {cwd}</Text>}
        </Box>

        <Box>
          <Text color={COLORS.dim}>thinking mode </Text>
          <Text color={thinkingModeEnabled ? COLORS.success : COLORS.muted} bold>
            {thinkingModeEnabled ? "on" : "off"}
          </Text>
          {!isMinimal && <Text color={COLORS.muted}> (Shift+Tab)</Text>}

          <Text color={COLORS.muted}> · </Text>
          <Text color={thinking ? COLORS.pending : COLORS.dim}>
            ⚡ {thinking ? "loading" : "idle"}
          </Text>

          <Text color={COLORS.muted}> · </Text>
          <Text color={activeTools > 0 ? COLORS.accent : COLORS.dim}>🔧 {activeTools}</Text>

          {hasTokenUsage && !isMinimal && (
            <>
              <Text color={COLORS.muted}> · </Text>
              <Text color={COLORS.dim} dimColor>
                📊 {formatTokens(tokenUsage.totalTokens)}
              </Text>
            </>
          )}
          {!isMinimal && activeTools > 0 && latestTool && (
            <Text color={COLORS.muted}> {latestTool}</Text>
          )}

          <Text color={COLORS.muted}> · </Text>
          <Text color={pendingConfirms > 0 ? COLORS.warning : COLORS.dim}>
            ⚠ {pendingConfirms}
          </Text>

          <Text color={COLORS.muted}> · </Text>
          <Text dimColor color={COLORS.dim}>
            {isMinimal ? "/help" : "/help for commands"}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

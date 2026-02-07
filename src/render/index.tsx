import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import { Provider, useAtomValue } from "jotai";
import * as os from "os";
import { Agent } from "../core/api/agent";
import { getEffectiveConfig } from "../core/api/config";
import { EventTimeline } from "./components/EventTimeline";
import { ConfirmSelectMenu, type ConfirmSelectOption } from "./components/ConfirmSelectMenu";
import { SlashCommandMenu } from "./components/SlashCommandMenu";
import { StatusBar } from "./components/StatusBar";
import { Spinner } from "./components/Spinner";
import { runSlashCommand, SLASH_COMMANDS } from "./commands";
import { historyAtom } from "./state/history";
import { loadingAtom, setLoading } from "./state/loading";
import { globalStore } from "./state/store";
import { COLORS } from "./theme";
import {
  addChatEvent,
  addConfirmEvent,
  addErrorEvent,
  addMcpEvent,
  addThinkingEvent,
  addToolEvent,
  appendChatContent,
  appendThinkingContent,
  completeToolEvent,
  eventsAtom,
  getActiveToolCount,
  getLatestToolEvent,
  getPendingConfirmCount,
  resolveConfirmEvent,
  toggleExpanded,
} from "./state/events";

const { model } = getEffectiveConfig();
const agent = new Agent({
  model,
  hooks: {
    onLoadingChange: (isLoading: boolean) => setLoading(isLoading),
  },
});

function toDisplayCwd(cwd: string): string {
  const home = os.homedir();
  if (cwd.startsWith(home)) {
    return `~${cwd.slice(home.length)}`;
  }
  return cwd;
}

function HeaderCard(props: { modelLabel: string; showTip: boolean }): React.JSX.Element {
  const cwd = toDisplayCwd(process.cwd());
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="single" borderColor={COLORS.border} paddingX={2} paddingY={0}>
        <Text color={COLORS.brand} bold>
          &gt;_ Hataraku
        </Text>
        <Text color={COLORS.muted}>  v1.0.0</Text>
      </Box>
      <Box marginTop={0}>
        <Text color={COLORS.muted}>model </Text>
        <Text color={COLORS.text} bold>{props.modelLabel}</Text>
        <Text color={COLORS.muted}>  ·  dir </Text>
        <Text color={COLORS.text}>{cwd}</Text>
        <Text color={COLORS.muted}>  ·  </Text>
        <Text color={COLORS.focus}>/help</Text>
      </Box>

      {props.showTip && (
        <Box marginTop={0}>
          <Text color={COLORS.muted}>
            Tip: <Text color={COLORS.text}>Shift+Tab</Text> thinking mode • <Text color={COLORS.text}>Ctrl+C</Text> interrupt
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ── Main App ──

function App(): React.JSX.Element {
  const history = useAtomValue(historyAtom, { store: globalStore });
  const events = useAtomValue(eventsAtom, { store: globalStore });
  const loading = useAtomValue(loadingAtom, { store: globalStore });

  const [query, setQuery] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(-1);
  const [showWelcome, setShowWelcome] = useState(true);
  const [modelLabel, setModelLabel] = useState(agent.model);
  const [thinkingMode, setThinkingMode] = useState(() => agent.getThinkingState());

  const [confirm, setConfirm] = useState<null | { id: string; toolName: string; reason: string; preview?: string }>(
    null,
  );
  const [confirmSelectedIndex, setConfirmSelectedIndex] = useState(1);
  const { stdout } = useStdout();

  const assistantEventIdRef = useRef<string | null>(null);
  const thinkingEventIdRef = useRef<string | null>(null);
  const terminalColumns = stdout?.columns ?? 120;
  const terminalRows = stdout?.rows ?? 40;
  const separatorLine = "─".repeat(Math.max(8, terminalColumns - 2));

  const pendingConfirms = useMemo(() => getPendingConfirmCount(events), [events]);
  const activeTools = useMemo(() => getActiveToolCount(events), [events]);
  const latestTool = useMemo(() => getLatestToolEvent(events), [events]);
  const isModelThinking = loading && activeTools === 0;
  const maxVisibleEvents = useMemo(() => {
    const usableRows = Math.max(8, terminalRows - 10);
    return Math.max(12, Math.min(100, Math.floor(usableRows * 1.6)));
  }, [terminalRows]);
  const visibleEvents = useMemo(() => events.slice(-maxVisibleEvents), [events, maxVisibleEvents]);
  const hiddenEventCount = Math.max(0, events.length - visibleEvents.length);
  const isSlashSuggesting = useMemo(() => {
    return query.trimStart().startsWith("/") && !confirm && !loading;
  }, [query, confirm, loading]);
  const filteredSlashCommands = useMemo(() => {
    if (!isSlashSuggesting) return [];
    const trimmed = query.trim();
    const rest = trimmed.startsWith("/") ? trimmed.slice(1).trim() : "";
    const needle = (rest.split(/\s+/)[0] ?? "").toLowerCase();
    if (!needle) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((command) => command.name.startsWith(needle));
  }, [isSlashSuggesting, query]);
  const shouldShowSlashMenu = isSlashSuggesting && filteredSlashCommands.length > 0;
  const confirmOptions: ConfirmSelectOption[] = useMemo(
    () => [
      { key: "allow", label: "Allow", description: "run this request once" },
      { key: "deny", label: "Deny", description: "cancel this request" },
    ],
    [],
  );

  useEffect(() => {
    if (!shouldShowSlashMenu) {
      setSlashSelectedIndex(-1);
      return;
    }
    setSlashSelectedIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= filteredSlashCommands.length) return filteredSlashCommands.length - 1;
      return prev;
    });
  }, [shouldShowSlashMenu, filteredSlashCommands.length]);

  useEffect(() => {
    agent.init();
    return () => {
      agent.cleanupMcp?.();
    };
  }, []);

  useEffect(() => {
    const handleUserMessage = (message: { role: "user"; content: string }) => {
      addChatEvent({ role: "user", content: message.content });
      globalStore.set(loadingAtom, true);
      setShowWelcome(false);
    };

    const handleAssistantStart = (message: { role: "assistant"; content: string }) => {
      const id = addChatEvent({ role: "assistant", content: message.content });
      assistantEventIdRef.current = id;
    };

    const handleAssistantDelta = (delta: string) => {
      const id = assistantEventIdRef.current;
      if (!id) return;
      appendChatContent({ id, delta });
    };

    const handleAssistantEnd = () => {
      assistantEventIdRef.current = null;
    };

    const handleAssistantThinkingStart = (message: { role: "thinking"; content: string; redacted?: boolean }) => {
      const id = addThinkingEvent({ content: message.content, redacted: message.redacted });
      thinkingEventIdRef.current = id;
    };

    const handleAssistantThinkingDelta = (delta: string) => {
      const id = thinkingEventIdRef.current;
      if (!id) return;
      appendThinkingContent({ id, delta });
    };

    const handleAssistantThinkingEnd = () => {
      thinkingEventIdRef.current = null;
    };

    const handleToolUse = (event: { toolUseId: string; toolName: string; input: unknown; preview?: string }) => {
      addToolEvent({ toolUseId: event.toolUseId, toolName: event.toolName, input: event.input, preview: event.preview });
    };

    const handleToolResult = (event: { toolUseId: string; toolName: string; result: string; filesChanged?: string[] }) => {
      completeToolEvent({ toolUseId: event.toolUseId, result: event.result, filesChanged: event.filesChanged });
    };

    const handleConfirmRequest = (request: { id: string; toolName: string; reason: string; preview?: string }) => {
      addConfirmEvent({ confirmId: request.id, toolName: request.toolName, reason: request.reason, preview: request.preview });
      setConfirm(request);
      setConfirmSelectedIndex(1);
    };

    const handleMcpConnectStart = (serverName: string) => addMcpEvent(`Connecting: ${serverName}`, "info");
    const handleMcpConnectSuccess = (serverName: string, toolCount: number) =>
      addMcpEvent(`Connected: ${serverName} (tools: ${toolCount})`, "info");
    const handleMcpConnectError = (serverName: string, error: Error) =>
      addMcpEvent(`Connection error: ${serverName} — ${error.message}`, "error");
    const handleMcpReconnectAttempt = (serverName: string, attempt: number, maxRetries: number) =>
      addMcpEvent(`Reconnect: ${serverName} (${attempt}/${maxRetries})`, "warn");
    const handleMcpHealthCheck = (serverName: string, _latency: number, healthy: boolean) => {
      if (!healthy) addMcpEvent(`Health check failed: ${serverName}`, "warn");
    };
    const handleMcpCacheHit = (serverName: string) => addMcpEvent(`Cache hit: ${serverName}`, "info");

    const handleError = (error: Error) => addErrorEvent({ message: error.message, stack: error.stack });

    agent.on("userMessage", handleUserMessage);
    agent.on("assistantMessageStart", handleAssistantStart);
    agent.on("assistantMessageDelta", handleAssistantDelta);
    agent.on("assistantMessageEnd", handleAssistantEnd);
    agent.on("assistantThinkingStart", handleAssistantThinkingStart);
    agent.on("assistantThinkingDelta", handleAssistantThinkingDelta);
    agent.on("assistantThinkingEnd", handleAssistantThinkingEnd);
    agent.on("toolUse", handleToolUse);
    agent.on("toolResult", handleToolResult);
    agent.on("confirmRequest", handleConfirmRequest);
    agent.on("mcpServerConnectStart", handleMcpConnectStart);
    agent.on("mcpServerConnectSuccess", handleMcpConnectSuccess);
    agent.on("mcpServerConnectError", handleMcpConnectError);
    agent.on("mcpReconnectAttempt", handleMcpReconnectAttempt);
    agent.on("mcpHealthCheck", handleMcpHealthCheck);
    agent.on("mcpCacheHit", handleMcpCacheHit);
    agent.on("error", handleError);

    return () => {
      agent.off("userMessage", handleUserMessage);
      agent.off("assistantMessageStart", handleAssistantStart);
      agent.off("assistantMessageDelta", handleAssistantDelta);
      agent.off("assistantMessageEnd", handleAssistantEnd);
      agent.off("assistantThinkingStart", handleAssistantThinkingStart);
      agent.off("assistantThinkingDelta", handleAssistantThinkingDelta);
      agent.off("assistantThinkingEnd", handleAssistantThinkingEnd);
      agent.off("toolUse", handleToolUse);
      agent.off("toolResult", handleToolResult);
      agent.off("confirmRequest", handleConfirmRequest);
      agent.off("mcpServerConnectStart", handleMcpConnectStart);
      agent.off("mcpServerConnectSuccess", handleMcpConnectSuccess);
      agent.off("mcpServerConnectError", handleMcpConnectError);
      agent.off("mcpReconnectAttempt", handleMcpReconnectAttempt);
      agent.off("mcpHealthCheck", handleMcpHealthCheck);
      agent.off("mcpCacheHit", handleMcpCacheHit);
      agent.off("error", handleError);
    };
  }, []);

  const handleConfirmAllow = (confirmId: string) => {
    agent.confirmResponse(confirmId, true);
    resolveConfirmEvent({ confirmId, allowed: true });
    setConfirm(null);
    setConfirmSelectedIndex(1);
  };

  const handleConfirmDeny = (confirmId: string) => {
    agent.confirmResponse(confirmId, false);
    resolveConfirmEvent({ confirmId, allowed: false });
    setConfirm(null);
    setConfirmSelectedIndex(1);
  };

  useInput((input, key) => {
    // Confirm mode: dropdown selection takes priority
    if (confirm) {
      if (key.upArrow || key.downArrow) {
        setConfirmSelectedIndex((prev) => {
          const next = key.upArrow ? prev - 1 : prev + 1;
          return (next + confirmOptions.length) % confirmOptions.length;
        });
        return;
      }

      if (key.return) {
        const selected = confirmOptions[confirmSelectedIndex]?.key ?? "deny";
        if (selected === "allow") {
          handleConfirmAllow(confirm.id);
          return;
        }
        handleConfirmDeny(confirm.id);
        return;
      }

      if (key.escape) {
        handleConfirmDeny(confirm.id);
      }
      return;
    }

    if (key.tab && key.shift) {
      const next = agent.setThinking({ enabled: !thinkingMode.enabled });
      setThinkingMode(next);
      return;
    }

    // Esc: toggle expand on latest tool event (quick inspect)
    if (key.escape) {
      if (latestTool) {
        toggleExpanded(latestTool.id);
      }
      return;
    }

    if (shouldShowSlashMenu) {
      if (key.upArrow) {
        setSlashSelectedIndex((prev) => {
          const next = prev < 0 ? 0 : prev - 1;
          return (next + filteredSlashCommands.length) % filteredSlashCommands.length;
        });
        return;
      }
      if (key.downArrow) {
        setSlashSelectedIndex((prev) => {
          const next = prev < 0 ? 0 : prev + 1;
          return next % filteredSlashCommands.length;
        });
        return;
      }
    }

    // Input history navigation
    if (key.upArrow && history.length > 0) {
      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      setQuery(history[nextIndex] || "");
      return;
    }

    if (key.downArrow) {
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setQuery("");
      } else {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setQuery(history[nextIndex] || "");
      }
    }
  });

  const handleSubmit = async () => {
    if (!query.trim() || loading || confirm) return;

    const selectedCommand =
      shouldShowSlashMenu && slashSelectedIndex >= 0 ? filteredSlashCommands[slashSelectedIndex] : undefined;
    const currentQuery = selectedCommand ? `/${selectedCommand.name}` : query;
    setQuery("");
    setHistoryIndex(-1);
    setSlashSelectedIndex(-1);

    const currentHistory = globalStore.get(historyAtom);
    globalStore.set(historyAtom, [currentQuery, ...currentHistory].slice(0, 200));

    const handled = await runSlashCommand(
      {
        agent,
        setModelLabel,
        setShowWelcome,
      },
      currentQuery,
    );
    if (handled) return;

    agent.runStream(currentQuery);
  };

  return (
    <Provider store={globalStore}>
      <Box flexDirection="column" paddingX={0}>
        <HeaderCard modelLabel={modelLabel} showTip={showWelcome} />

        {/* Streaming timeline — all events in chronological order */}
        {events.length > 0 && (
          <EventTimeline
            events={visibleEvents}
            hiddenEventCount={hiddenEventCount}
            activeConfirmId={confirm?.id ?? null}
          />
        )}

        {/* Loading indicator */}
        {isModelThinking && !confirm && (
          <Box marginBottom={1}>
            <Text color={COLORS.accent}>
              <Spinner /> loading
            </Text>
          </Box>
        )}

        {/* Input area */}
        <Box flexDirection="column" marginBottom={1}>
          {confirm ? (
            <ConfirmSelectMenu
              toolName={confirm.toolName}
              reason={confirm.reason}
              preview={confirm.preview}
              options={confirmOptions}
              selectedIndex={confirmSelectedIndex}
            />
          ) : (
            <Box>
              <Text color={COLORS.dim}>
                {loading
                  ? "Waiting for response…"
                  : "Enter message or slash command"}
              </Text>
            </Box>
          )}
        </Box>

        <Box flexDirection="column" marginTop={events.length > 0 ? 0 : 1}>
          <Text color={COLORS.border}>{separatorLine}</Text>
          <Box>
            <Text color={COLORS.accent} bold>❯ </Text>
            <TextInput
              placeholder={
                confirm
                  ? "Confirm pending… use ↑/↓ then Enter"
                  : loading
                    ? "Waiting for response…"
                    : "Message…"
              }
              value={query}
              onChange={loading || confirm ? () => {} : setQuery}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>

        {shouldShowSlashMenu && (
          <SlashCommandMenu
            commands={filteredSlashCommands}
            selectedIndex={slashSelectedIndex}
            query={query}
            terminalColumns={terminalColumns}
          />
        )}

        <StatusBar
          model={modelLabel}
          cwd={toDisplayCwd(process.cwd())}
          terminalColumns={terminalColumns}
          pendingConfirms={pendingConfirms}
          activeTools={activeTools}
          latestTool={latestTool?.toolName ?? ""}
          thinking={isModelThinking}
          thinkingModeEnabled={thinkingMode.enabled}
        />
      </Box>
    </Provider>
  );
}

export { App };

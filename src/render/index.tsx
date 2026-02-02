import { useState, useEffect, useMemo } from 'react';
import { useInput, Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { Provider, useAtomValue } from 'jotai';
import { historyAtom } from './state/history';
import { messageListAtom } from './state/message';
import { loadingAtom } from './state/loading';
import { globalStore } from './state/store';
import { Agent } from '../core/agent';
import { getEffectiveConfig } from '../core/config';
import * as path from 'path';

const { model } = getEffectiveConfig();
const agent = new Agent({ model });

const COLORS = {
  pink: '#d33682',
  orange: '#cb4b16',
  cyan: '#2aa198',
  green: '#859900',
  yellow: '#b58900',
  gray: '#586e75',
  darkGray: '#073642',
  lightGray: '#93a1a1',
  white: '#fdf6e3',
  red: '#dc322f',
};

const PINK_PIG = `
    (\   /)
     (◕‿◕)
   ~~~∧∧∧~~~
`;

const WelcomeHeader = () => {
  const cwd = process.cwd();
  const projectName = path.basename(cwd);

  return (
    <Box flexDirection='column' paddingBottom={1}>
      <Box>
        <Text color={COLORS.red}>╭─────────────────────────────────────────────────────────────────────────╮</Text>
      </Box>
      <Box>
        <Text color={COLORS.red}>│  </Text>
        <Text bold color={COLORS.pink}>Coding Agent</Text>
        <Text color={COLORS.lightGray}> v1.0.0</Text>
        <Text>                                                    </Text>
        <Text color={COLORS.red}>│</Text>
      </Box>
      <Box>
        <Text color={COLORS.red}>├─────────────────────────────────────────────────────────────────────────┤</Text>
      </Box>
      <Box flexDirection='row'>
        <Box width={32} flexDirection='column' paddingLeft={2}>
          <Text bold color={COLORS.white}>Welcome back!</Text>
          <Box paddingTop={1}>
            <Text color={COLORS.pink}>{PINK_PIG}</Text>
          </Box>
          <Box paddingTop={1}>
            <Text bold color={COLORS.white}>{projectName}</Text>
          </Box>
          <Box>
            <Text color={COLORS.gray}>{cwd}</Text>
          </Box>
        </Box>
        <Box>
          <Text color={COLORS.red}>│</Text>
        </Box>
        <Box flexDirection='column' paddingLeft={2}>
          <Box>
            <Text bold color={COLORS.pink}>Tips for getting started</Text>
          </Box>
          <Box paddingBottom={1}>
            <Text color={COLORS.lightGray}>Run /init to create a CLAUDE.md file with instructions for Claude</Text>
          </Box>
          <Box>
            <Text bold color={COLORS.pink}>Recent activity</Text>
          </Box>
          <Box>
            <Text color={COLORS.lightGray}>No recent activity</Text>
          </Box>
        </Box>
      </Box>
      <Box>
        <Text color={COLORS.red}>╰─────────────────────────────────────────────────────────────────────────╯</Text>
      </Box>
    </Box>
  );
};

const MessageItem = ({ item, index }: { item: { role: string; content: string }; index: number }) => {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user':
        return COLORS.cyan;
      case 'assistant':
        return COLORS.white;
      case 'system':
        return COLORS.yellow;
      default:
        return COLORS.lightGray;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'user':
        return '❯';
      case 'assistant':
        return '●';
      case 'system':
        return '◆';
      default:
        return '•';
    }
  };

  const lines = item.content.split('\n');

  return (
    <Box flexDirection='column' paddingBottom={1}>
      <Box>
        <Text color={getRoleColor(item.role)}>{getRoleLabel(item.role)} </Text>
        <Text bold color={getRoleColor(item.role)}>{item.role}</Text>
      </Box>
      {lines.map((line, lineIndex) => (
        <Box key={lineIndex} paddingLeft={2}>
          <Text color={item.role === 'user' ? COLORS.cyan : item.role === 'assistant' ? COLORS.lightGray : COLORS.gray}>
            {line || ' '}
          </Text>
        </Box>
      ))}
    </Box>
  );
};

const App = () => {
  const history = useAtomValue(historyAtom, { store: globalStore });
  const messages = useAtomValue(messageListAtom, { store: globalStore });
  const loading = useAtomValue(loadingAtom, { store: globalStore });
  const [_, setHistoryIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    agent.init();
    return () => {
      agent.cleanupMcp?.();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages.length]);

  useEffect(() => {
    const handleUserMessage = (message: { role: 'user'; content: string }) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [...messageList, message]);
      globalStore.set(loadingAtom, true);
    };

    const handleAssistantStart = (message: {
      role: 'assistant';
      content: string;
    }) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [...messageList, message]);
    };

    const handleAssistantDelta = (delta: string) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      const lastMessage = messageList[messageList.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        const updatedMessages = [...messageList];
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + delta,
        };
        globalStore.set(messageListAtom, updatedMessages);
      }
    };

    const handleAssistantMessageEnd = () => {
      globalStore.set(loadingAtom, false);
    };

    const handleToolUse = (toolName: string, input: any) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [
        ...messageList,
        {
          role: 'system',
          content: `🔧 使用工具: ${toolName}\n输入: ${JSON.stringify(input, null, 2)}`,
        },
      ]);
    };

    const handleToolResult = (toolName: string, result: string) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [
        ...messageList,
        { role: 'system', content: `✅ 工具结果: ${toolName}\n${result}` },
      ]);
    };

    const handleMcpConnectStart = (serverName: string) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [
        ...messageList,
        { role: 'system', content: `🔌 MCP 连接中: ${serverName}` },
      ]);
    };

    const handleMcpConnectSuccess = (serverName: string, toolCount: number) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [
        ...messageList,
        {
          role: 'system',
          content: `✅ MCP 已连接: ${serverName} (tools: ${toolCount})`,
        },
      ]);
    };

    const handleMcpConnectError = (serverName: string, error: Error) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [
        ...messageList,
        {
          role: 'system',
          content: `❌ MCP 连接失败: ${serverName}\n${error.message}`,
        },
      ]);
    };

    const handleError = (error: Error) => {
      console.error('Agent error:', error);
    };

    agent.on('userMessage', handleUserMessage);
    agent.on('assistantMessageStart', handleAssistantStart);
    agent.on('assistantMessageDelta', handleAssistantDelta);
    agent.on('assistantMessageEnd', handleAssistantMessageEnd);
    agent.on('toolUse', handleToolUse);
    agent.on('toolResult', handleToolResult);
    agent.on('mcpServerConnectStart', handleMcpConnectStart);
    agent.on('mcpServerConnectSuccess', handleMcpConnectSuccess);
    agent.on('mcpServerConnectError', handleMcpConnectError);
    agent.on('error', handleError);

    return () => {
      agent.off('userMessage', handleUserMessage);
      agent.off('assistantMessageStart', handleAssistantStart);
      agent.off('assistantMessageDelta', handleAssistantDelta);
      agent.off('assistantMessageEnd', handleAssistantMessageEnd);
      agent.off('toolUse', handleToolUse);
      agent.off('toolResult', handleToolResult);
      agent.off('mcpServerConnectStart', handleMcpConnectStart);
      agent.off('mcpServerConnectSuccess', handleMcpConnectSuccess);
      agent.off('mcpServerConnectError', handleMcpConnectError);
      agent.off('error', handleError);
    };
  }, []);

  useInput((_input, key) => {
    if (key.upArrow && history.length > 0) {
      setHistoryIndex((pre) => {
        const newIndex = Math.min(pre + 1, history.length - 1);
        setQuery(history[newIndex] || '');
        return newIndex;
      });
    }
    if (key.downArrow) {
      setHistoryIndex((pre) => {
        const newIndex = Math.max(0, pre - 1);
        setQuery(history[newIndex] || '');
        return newIndex;
      });
    }
  });

  const handleSubmit = async () => {
    if (!query.trim() || loading) return;

    const currentQuery = query;
    setQuery('');
    setHistoryIndex(0);

    agent.runStream(currentQuery);
  };

  return (
    <Provider store={globalStore}>
      <Box flexDirection='column'>
        {showWelcome && (
          <>
            <WelcomeHeader />
            <Box paddingTop={1} paddingBottom={1}>
              <Text color={COLORS.lightGray}>/model to try Opus 4.5</Text>
            </Box>
          </>
        )}

        <Box flexDirection='column' gap={1}>
          {messages.map((item, index) => (
            <MessageItem key={index} item={item} index={index} />
          ))}
          {loading && (
            <Box paddingLeft={2}>
              <Text color={COLORS.gray}>Thinking...</Text>
            </Box>
          )}
        </Box>

        <Box paddingTop={1} paddingBottom={1}>
          <Text color={COLORS.gray}>──────────────────────────────────────────────────────────────────────────</Text>
        </Box>

        <Box>
          <Text color={loading ? COLORS.gray : COLORS.white}>&gt; </Text>
          <TextInput
            placeholder={loading ? 'Waiting for response...' : 'Try "fix lint errors"'}
            value={query}
            onChange={loading ? () => {} : setQuery}
            onSubmit={handleSubmit}
          />
        </Box>

        <Box flexDirection='row' justifyContent='space-between' paddingTop={1}>
          <Text color={COLORS.lightGray}>? for shortcuts</Text>
          <Text color={COLORS.orange}>⌘ In index.tsx</Text>
        </Box>
      </Box>
    </Provider>
  );
};

export { App };

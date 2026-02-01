import { useState, useEffect } from "react";
import { useInput, Box, Text } from "ink";
import TextInput from "ink-text-input";
import { Provider, useAtomValue } from "jotai";
import { historyAtom } from "./state/history";
import { messageListAtom } from "./state/message";
import { loadingAtom } from "./state/loading";
import { globalStore } from "./state/store";
import { Agent } from "../core/agent";
import { client } from "../core/client";
import { bashTool } from "../core/tools/index"
const ToolMap = new Map();
ToolMap.set(bashTool.name, bashTool)

const agent = new Agent("ark-code-latest", client, ToolMap);

const App = () => {
  const history = useAtomValue(historyAtom, { store: globalStore });
  const messages = useAtomValue(messageListAtom, { store: globalStore });
  const loading = useAtomValue(loadingAtom, { store: globalStore });
  const [_, setHistoryIndex] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    // 监听用户消息
    const handleUserMessage = (message: { role: "user"; content: string }) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [...messageList, message]);
      globalStore.set(loadingAtom, true)
    };

    // 监听 assistant 消息开始
    const handleAssistantStart = (message: { role: "assistant"; content: string }) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [...messageList, message]);
    };

    // 监听 assistant 消息增量
    const handleAssistantDelta = (delta: string) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      const lastMessage = messageList[messageList.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        const updatedMessages = [...messageList];
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + delta,
        };
        globalStore.set(messageListAtom, updatedMessages);
      }
    };

    const handleAssistantMessageEnd = () => {
      globalStore.set(loadingAtom, false)
    }

    // 监听 tool 使用
    const handleToolUse = (toolName: string, input: any) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [
        ...messageList,
        { role: "system", content: `🔧 使用工具: ${toolName}\n输入: ${JSON.stringify(input, null, 2)}` }
      ]);
    };

    // 监听 tool 结果
    const handleToolResult = (toolName: string, result: string) => {
      const messageList = globalStore.get(messageListAtom) ?? [];
      globalStore.set(messageListAtom, [
        ...messageList,
        { role: "system", content: `✅ 工具结果: ${toolName}\n${result}` }
      ]);
    };

    // 监听错误
    const handleError = (error: Error) => {
      console.error("Agent error:", error);
    };

    agent.on("userMessage", handleUserMessage);
    agent.on("assistantMessageStart", handleAssistantStart);
    agent.on("assistantMessageDelta", handleAssistantDelta);
    agent.on('assistantMessageEnd', handleAssistantMessageEnd)
    agent.on("toolUse", handleToolUse);
    agent.on("toolResult", handleToolResult);
    agent.on("error", handleError);

    return () => {
      agent.off("userMessage", handleUserMessage);
      agent.off("assistantMessageStart", handleAssistantStart);
      agent.off("assistantMessageDelta", handleAssistantDelta);
      agent.off('assistantMessageEnd', handleAssistantMessageEnd)
      agent.off("toolUse", handleToolUse);
      agent.off("toolResult", handleToolResult);
      agent.off("error", handleError);
    };
  }, []);

  useInput((_input, key) => {
    if (key.upArrow && history.length > 0) {
      setHistoryIndex((pre) => {
        const newIndex = Math.min(pre + 1, history.length - 1);
        setQuery(history[newIndex] || "");
        return newIndex;
      });
    }
    if (key.downArrow) {
      setHistoryIndex((pre) => {
        const newIndex = Math.max(0, pre - 1);
        setQuery(history[newIndex] || "");
        return newIndex;
      });
    }
  });

  const handleSubmit = async () => {
    if (!query.trim() || loading) return;

    const currentQuery = query;
    setQuery("");
    setHistoryIndex(0);

    agent.runStream(currentQuery);
  };

  return (
    <Provider store={globalStore}>
      <Box flexDirection="column">
        <Box marginRight={1} flexDirection="column" gap={2}>
          {messages.map((item, index) => (
            <Text key={index}>
              {item.role} : {item.content}
            </Text>
          ))}
          {loading && <Text color="gray">正在思考...</Text>}
        </Box>
        <Box backgroundColor={"gray"} height="1px" width="100%"></Box>
        <TextInput
          placeholder={loading ? "等待回复中..." : "> 输入你的内容"}
          value={query}
          onChange={loading ? () => { } : setQuery}
          onSubmit={handleSubmit}
        />
      </Box>
    </Provider>
  );
};

export { App };

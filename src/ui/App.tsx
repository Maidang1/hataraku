/** @jsxImportSource react */
import React, { useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { MessageDisplay, type Message } from "./components/MessageDisplay.js";
import { Input } from "./components/Input.js";
import { ToolStatusPanel, type ToolExecution } from "./components/ToolStatusPanel.js";
import { Confirmation } from "./components/Confirmation.js";

export interface AppProps {
  apiKey: string;
}

export const App: React.FC<AppProps> = ({ apiKey }) => {
  const { exit } = useApp();
  
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [currentTool, setCurrentTool] = useState<ToolExecution | null>(null);
  const [toolHistory, setToolHistory] = useState<ToolExecution[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    toolName: string;
    description: string;
  } | null>(null);

  // Exit handler
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
    }
  });

  // Input handlers
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const handleSubmit = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    setMessages(prev => [...prev, { role: "user", content: inputValue }]);
    
    // Simulate assistant response (placeholder for v1.0)
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "LLM integration is not yet complete. This is a placeholder response." 
      }]);
    }, 100);
    
    setInputValue("");
  };

  // Confirmation handlers
  const handleConfirm = () => {
    setPendingConfirmation(null);
  };

  const handleReject = () => {
    setPendingConfirmation(null);
  };

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text bold color="cyan">
          Claude CLI Agent
        </Text>
        <Text dimColor> | Press Ctrl+C to exit</Text>
      </Box>

      {/* Main 3-column layout */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left: Message History */}
        <Box width="33%" borderStyle="single" borderColor="blue" padding={1} flexDirection="column">
          <Text bold underline color="blue">Message History</Text>
          <MessageDisplay messages={messages} />
        </Box>

        {/* Middle: Current Streaming Output */}
        <Box width="34%" borderStyle="single" borderColor="green" padding={1} flexDirection="column">
          <Text bold underline color="green">Current Output</Text>
          <Text dimColor>Streaming placeholder (not yet implemented)</Text>
        </Box>

        {/* Right: Tool Status */}
        <Box width="33%" flexDirection="column">
          <ToolStatusPanel currentTool={currentTool} history={toolHistory} />
        </Box>
      </Box>

      {/* Confirmation overlay */}
      {pendingConfirmation && (
        <Box>
          <Confirmation
            confirmation={pendingConfirmation}
            onConfirm={handleConfirm}
            onReject={handleReject}
          />
        </Box>
      )}

      {/* Bottom: Input */}
      <Box borderStyle="single" borderColor="yellow" paddingX={1}>
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          placeholder="Type your message and press Enter..."
        />
      </Box>
    </Box>
  );
};

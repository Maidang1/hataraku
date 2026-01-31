/** @jsxImportSource react */
import React from "react";
import { Box, Text } from "ink";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface MessageDisplayProps {
  messages: Message[];
}

export const MessageDisplay: React.FC<MessageDisplayProps> = ({ messages }) => {
  return (
    <Box flexDirection="column">
      {messages.map((message, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Text bold color={message.role === "user" ? "green" : "blue"}>
            {message.role === "user" ? "You:" : "Assistant:"}
          </Text>
          <Text>{message.content}</Text>
        </Box>
      ))}
    </Box>
  );
};

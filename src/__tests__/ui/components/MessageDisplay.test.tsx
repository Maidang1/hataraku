/** @jsxImportSource react */
import { test, expect, describe } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { MessageDisplay } from "../../../ui/components/MessageDisplay";

describe("MessageDisplay Component", () => {
  test("renders empty message list", () => {
    const { lastFrame } = render(<MessageDisplay messages={[]} />);
    const output = lastFrame();
    
    expect(output).toBeDefined();
  });

  test("renders user message", () => {
    const messages = [
      { role: "user" as const, content: "Hello, assistant!" },
    ];
    
    const { lastFrame } = render(<MessageDisplay messages={messages} />);
    const output = lastFrame();
    
    expect(output).toContain("Hello, assistant!");
    expect(output).toContain("You:");
  });

  test("renders assistant message", () => {
    const messages = [
      { role: "assistant" as const, content: "Hello! How can I help you?" },
    ];
    
    const { lastFrame } = render(<MessageDisplay messages={messages} />);
    const output = lastFrame();
    
    expect(output).toContain("Hello! How can I help you?");
    expect(output).toContain("Assistant:");
  });

  test("renders multiple messages in order", () => {
    const messages = [
      { role: "user" as const, content: "First message" },
      { role: "assistant" as const, content: "Second message" },
      { role: "user" as const, content: "Third message" },
    ];
    
    const { lastFrame } = render(<MessageDisplay messages={messages} />);
    const output = lastFrame();
    
    expect(output).toContain("First message");
    expect(output).toContain("Second message");
    expect(output).toContain("Third message");
  });

  test("handles streaming text update", () => {
    const messages = [
      { role: "assistant" as const, content: "Streaming" },
    ];
    
    const { lastFrame, rerender } = render(<MessageDisplay messages={messages} />);
    expect(lastFrame()).toContain("Streaming");
    
    const updatedMessages = [
      { role: "assistant" as const, content: "Streaming text..." },
    ];
    rerender(<MessageDisplay messages={updatedMessages} />);
    expect(lastFrame()).toContain("Streaming text...");
  });

  test("displays role labels correctly", () => {
    const messages = [
      { role: "user" as const, content: "User message" },
      { role: "assistant" as const, content: "Assistant message" },
    ];
    
    const { lastFrame } = render(<MessageDisplay messages={messages} />);
    const output = lastFrame();
    
    expect(output).toContain("You:");
    expect(output).toContain("Assistant:");
  });

  test("renders without crashing with many messages", () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message ${i + 1}`,
    }));
    
    expect(() => render(<MessageDisplay messages={messages} />)).not.toThrow();
  });
});

import React from "react";
import { Box, Text } from "ink";
import { COLORS } from "../theme";

/**
 * Simple terminal Markdown renderer for assistant messages.
 * Supports: code blocks, inline code, bold, headers, lists, and plain text.
 * No external dependencies — pure Ink components.
 */
export function MarkdownText(props: { content: string }): React.JSX.Element {
  const { content } = props;
  const lines = content.split("\n");
  const elements: React.JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code block: ```
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trimStart().startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <Box key={`code-${elements.length}`} flexDirection="column" marginY={0} paddingLeft={2}>
          {lang && (
            <Text color="white">{lang}</Text>
          )}
          {codeLines.map((cl, ci) => (
            <Text key={ci} color="white">{cl || " "}</Text>
          ))}
        </Box>
      );
      continue;
    }

    // Heading: # ## ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      elements.push(
        <Box key={`h-${elements.length}`} paddingLeft={0}>
          <Text color="white" bold>{headingMatch[2]}</Text>
        </Box>
      );
      i++;
      continue;
    }

    // Unordered list: - or *
    const listMatch = line.match(/^(\s*)[*-]\s+(.*)/);
    if (listMatch) {
      const indent = Math.floor((listMatch[1]?.length ?? 0) / 2);
      elements.push(
        <Box key={`li-${elements.length}`} paddingLeft={indent * 2 + 2}>
          <Text color="white">• </Text>
          <InlineMarkdown text={listMatch[2]!} />
        </Box>
      );
      i++;
      continue;
    }

    // Ordered list: 1. 2. etc
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (olMatch) {
      const indent = Math.floor((olMatch[1]?.length ?? 0) / 2);
      const numMatch = line.match(/^(\s*)(\d+)\./);
      const num = numMatch ? numMatch[2] : "•";
      elements.push(
        <Box key={`ol-${elements.length}`} paddingLeft={indent * 2 + 2}>
          <Text color="white">{num}. </Text>
          <InlineMarkdown text={olMatch[2]!} />
        </Box>
      );
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(
        <Box key={`empty-${elements.length}`}>
          <Text> </Text>
        </Box>
      );
      i++;
      continue;
    }

    // Regular paragraph line
    elements.push(
      <Box key={`p-${elements.length}`} paddingLeft={0}>
        <InlineMarkdown text={line} />
      </Box>
    );
    i++;
  }

  return <Box flexDirection="column">{elements}</Box>;
}

/**
 * Renders inline markdown: **bold**, `code`, and plain text.
 */
function InlineMarkdown(props: { text: string }): React.JSX.Element {
  const { text } = props;
  // Split on **bold** and `code` patterns
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return (
    <Text color="white">
      {parts.map((part, i) => {
        // Bold: **text**
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <Text key={i} bold color="white">
              {part.slice(2, -2)}
            </Text>
          );
        }
        // Inline code: `text`
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Text key={i} color="white">
              {part.slice(1, -1)}
            </Text>
          );
        }
        // Plain text
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

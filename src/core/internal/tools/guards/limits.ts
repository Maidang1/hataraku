type LimitTextOptions = {
  offset?: number;
  maxLines?: number;
  maxLineLength?: number;
};

export type LimitTextResult = {
  content: string;
  truncated: boolean;
  fileTotalLines: number;
  actualOffset: number;
  actualLimit: number;
};

export function limitText(
  content: string,
  options: LimitTextOptions = {},
): LimitTextResult {
  const offset = Math.max(0, options.offset ?? 0);
  const maxLines = Math.max(1, options.maxLines ?? 2000);
  const maxLineLength = Math.max(1, options.maxLineLength ?? 2000);

  const allLines = content.replace(/\r\n/g, "\n").split("\n");
  const fileTotalLines = allLines.length;
  const sliced = allLines.slice(offset, offset + maxLines);

  let truncated = offset + maxLines < fileTotalLines;
  const limitedLines = sliced.map((line) => {
    if (line.length > maxLineLength) {
      truncated = true;
      return `${line.slice(0, maxLineLength)}...`;
    }
    return line;
  });

  return {
    content: limitedLines.join("\n"),
    truncated,
    fileTotalLines,
    actualOffset: offset,
    actualLimit: maxLines,
  };
}

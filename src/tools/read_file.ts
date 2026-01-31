import { ToolResult, DangerLevel, createSafeTool } from "./types";

interface ReadFileInput {
  path: string;
}

async function readFileImpl(input: ReadFileInput): Promise<ToolResult<string>> {
  try {
    const filePath = input.path;
    const file = Bun.file(filePath);
    const exists = await file.exists();
    
    if (!exists) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    const isDirectory = (await file.stat()).isDirectory();
    if (isDirectory) {
      return {
        success: false,
        error: `Path is a directory, not a file: ${filePath}`,
      };
    }

    const content = await file.text();
    return {
      success: true,
      data: content,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to read file: ${errorMessage}`,
    };
  }
}

export const definition = createSafeTool({
  name: "read_file",
  description: "Reads the contents of a file and returns it as a string",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file to read",
      },
    },
    required: ["path"],
  },
});

export async function readFile(input: ReadFileInput): Promise<ToolResult<string>> {
  return readFileImpl(input);
}

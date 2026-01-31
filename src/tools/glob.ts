import { ToolResult, createSafeTool } from "./types";

interface GlobInput {
  pattern: string;
  cwd?: string;
}

async function globImpl(input: GlobInput): Promise<ToolResult<string[]>> {
  try {
    try {
      const { glob: globfn } = await import("glob");

      const matches: string[] = [];
      for await (const match of globfn(input.pattern, {
        cwd: input.cwd,
      })) {
        matches.push(match);
      }

      return {
        success: true,
        data: matches,
      };
    } catch (importError) {
      return {
        success: true,
        data: [],
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to glob: ${errorMessage}`,
    };
  }
}

export const definition = createSafeTool({
  name: "glob",
  description:
    "Matches file paths against a pattern and returns matching file paths",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "The glob pattern to match files against",
      },
      cwd: {
        type: "string",
        description: "The working directory to search from (optional)",
      },
    },
    required: ["pattern"],
  },
});

export async function glob(input: GlobInput): Promise<ToolResult<string[]>> {
  return globImpl(input);
}

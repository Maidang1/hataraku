import { ToolResult, createDangerousTool } from "./types";

interface EditFileInput {
  path: string;
  search: string;
  replace: string;
}

async function editFileImpl(
  input: EditFileInput
): Promise<ToolResult<string>> {
  try {
    const file = Bun.file(input.path);

    if (!(await file.exists())) {
      return {
        success: false,
        error: `File not found: ${input.path}`,
      };
    }

    const content = await file.text();

    if (!content.includes(input.search)) {
      return {
        success: false,
        error: `Search text not found in file: "${input.search}"`,
      };
    }

    const occurrences = (content.match(new RegExp(escapeRegex(input.search), "g")) || []).length;
    const newContent = content.replaceAll(input.search, input.replace);

    await Bun.write(input.path, newContent);

    return {
      success: true,
      data: `Successfully replaced ${occurrences} occurrence(s) in ${input.path}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to edit file: ${errorMessage}`,
    };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const definition = createDangerousTool({
  name: "edit_file",
  description:
    "Edits a file by searching for text and replacing it. Replaces all occurrences. Returns error if search text not found.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The path to the file to edit",
      },
      search: {
        type: "string",
        description: "The text to search for",
      },
      replace: {
        type: "string",
        description: "The text to replace with",
      },
    },
    required: ["path", "search", "replace"],
  },
});

export async function editFile(
  input: EditFileInput
): Promise<ToolResult<string>> {
  return editFileImpl(input);
}

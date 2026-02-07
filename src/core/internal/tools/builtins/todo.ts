import type Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { Tool, type ToolExecutionContext, type ToolExecutionResult } from "../base";

export type TodoItem = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high";
  description?: string;
};

const TODO_FILE = ".hataraku/todos.json";

function resolveTodoFile(cwd: string): string {
  return path.resolve(cwd, TODO_FILE);
}

function readTodos(cwd: string): TodoItem[] {
  const filePath = resolveTodoFile(cwd);
  if (!fs.existsSync(filePath)) return [];

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TodoItem[]) : [];
  } catch {
    return [];
  }
}

function writeTodos(cwd: string, todos: TodoItem[]): void {
  const filePath = resolveTodoFile(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(todos, null, 2), "utf8");
}

export class TodoReadTool extends Tool {
  name = "todo_read";
  description = "Read current todo list.";
  readonly = true;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {},
      },
    };
  }

  override execute(_: Record<string, unknown>, context: ToolExecutionContext): ToolExecutionResult {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    const todos = readTodos(context.cwd);
    return {
      content: JSON.stringify({ todos }, null, 2),
    };
  }
}

export class TodoWriteTool extends Tool {
  name = "todo_write";
  description = "Replace todo list. Input: { todos }";
  readonly = false;

  override getSchema(): Anthropic.Tool {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                content: { type: "string" },
                status: {
                  type: "string",
                  enum: ["pending", "in_progress", "completed", "cancelled"],
                },
                priority: { type: "string", enum: ["low", "medium", "high"] },
                description: { type: "string" },
              },
              required: ["id", "content", "status"],
            },
          },
        },
        required: ["todos"],
      },
    };
  }

  override execute(input: { todos: TodoItem[] }, context: ToolExecutionContext): ToolExecutionResult {
    if (context.signal?.aborted) {
      return { isError: true, isAborted: true, message: "Aborted" };
    }

    try {
      const todos = Array.isArray(input.todos) ? input.todos : [];
      writeTodos(context.cwd, todos);
      return {
        content: JSON.stringify({ todos }, null, 2),
        filesChanged: [TODO_FILE],
      };
    } catch (error) {
      return {
        isError: true,
        message: `Failed to write todos: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

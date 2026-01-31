export type ToolResult<T> =
  | {
      success: true;
      data: T;
      error?: undefined;
    }
  | {
      success: false;
      error: string;
      data?: undefined;
    };

export const DangerLevel = {
  safe: "safe",
  dangerous: "dangerous",
} as const;

export type DangerLevelType = (typeof DangerLevel)[keyof typeof DangerLevel];

interface ToolConfig {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

interface ToolDefinition extends ToolConfig {
  input_schema: Record<string, any>;
  dangerLevel: DangerLevelType;
}

export function createSafeTool(config: ToolConfig): ToolDefinition {
  return {
    name: config.name,
    description: config.description,
    input_schema: config.inputSchema,
    dangerLevel: DangerLevel.safe,
  };
}

export function createDangerousTool(config: ToolConfig): ToolDefinition {
  return {
    name: config.name,
    description: config.description,
    input_schema: config.inputSchema,
    dangerLevel: DangerLevel.dangerous,
  };
}

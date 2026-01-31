import { test, expect, describe } from "bun:test";
import {
  ToolResult,
  DangerLevel,
  createSafeTool,
  createDangerousTool,
} from "../../tools/types";

describe("ToolResult Type", () => {
  test("ToolResult can be created with success and data", () => {
    const result: ToolResult<string> = {
      success: true,
      data: "test data",
    };
    expect(result.success).toBe(true);
    expect(result.data).toBe("test data");
    expect(result.error).toBeUndefined();
  });

  test("ToolResult can be created with success false and error", () => {
    const result: ToolResult<never> = {
      success: false,
      error: "Something went wrong",
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe("Something went wrong");
    expect(result.data).toBeUndefined();
  });

  test("ToolResult has all required properties", () => {
    const successResult: ToolResult<number> = {
      success: true,
      data: 42,
    };
    const failureResult: ToolResult<never> = {
      success: false,
      error: "failed",
    };

    expect(successResult).toHaveProperty("success");
    expect(successResult).toHaveProperty("data");
    expect(failureResult).toHaveProperty("success");
    expect(failureResult).toHaveProperty("error");
  });
});

describe("DangerLevel Enum", () => {
  test("DangerLevel has 'safe' value", () => {
    expect(DangerLevel.safe).toBeDefined();
  });

  test("DangerLevel has 'dangerous' value", () => {
    expect(DangerLevel.dangerous).toBeDefined();
  });

  test("DangerLevel.safe is a string 'safe'", () => {
    expect(DangerLevel.safe).toBe("safe");
  });

  test("DangerLevel.dangerous is a string 'dangerous'", () => {
    expect(DangerLevel.dangerous).toBe("dangerous");
  });

  test("DangerLevel has exactly two values", () => {
    const values = Object.values(DangerLevel);
    expect(values.length).toBe(2);
  });
});

describe("createSafeTool Helper", () => {
  test("createSafeTool returns an object", () => {
    const tool = createSafeTool({
      name: "test_safe_tool",
      description: "A safe test tool",
      inputSchema: { type: "object", properties: {} },
    });
    expect(tool).toBeDefined();
    expect(typeof tool).toBe("object");
  });

  test("createSafeTool result has correct name", () => {
    const tool = createSafeTool({
      name: "read_file",
      description: "Reads a file",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
      },
    });
    expect(tool.name).toBe("read_file");
  });

  test("createSafeTool result has description", () => {
    const tool = createSafeTool({
      name: "safe_op",
      description: "A safe operation",
      inputSchema: { type: "object", properties: {} },
    });
    expect(tool.description).toBe("A safe operation");
  });

  test("createSafeTool result has input_schema", () => {
    const tool = createSafeTool({
      name: "test",
      description: "test",
      inputSchema: {
        type: "object",
        properties: {
          param: { type: "string" },
        },
      },
    });
    expect(tool).toHaveProperty("input_schema");
  });

  test("createSafeTool is marked as safe", () => {
    const tool = createSafeTool({
      name: "safe_tool",
      description: "safe",
      inputSchema: { type: "object", properties: {} },
    });
    expect(tool.dangerLevel).toBe(DangerLevel.safe);
  });
});

describe("createDangerousTool Helper", () => {
  test("createDangerousTool returns an object", () => {
    const tool = createDangerousTool({
      name: "test_dangerous_tool",
      description: "A dangerous test tool",
      inputSchema: { type: "object", properties: {} },
    });
    expect(tool).toBeDefined();
    expect(typeof tool).toBe("object");
  });

  test("createDangerousTool result has correct name", () => {
    const tool = createDangerousTool({
      name: "execute_command",
      description: "Executes shell command",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
      },
    });
    expect(tool.name).toBe("execute_command");
  });

  test("createDangerousTool result has description", () => {
    const tool = createDangerousTool({
      name: "dangerous_op",
      description: "A dangerous operation",
      inputSchema: { type: "object", properties: {} },
    });
    expect(tool.description).toBe("A dangerous operation");
  });

  test("createDangerousTool result has input_schema", () => {
    const tool = createDangerousTool({
      name: "test",
      description: "test",
      inputSchema: {
        type: "object",
        properties: {
          param: { type: "string" },
        },
      },
    });
    expect(tool).toHaveProperty("input_schema");
  });

  test("createDangerousTool is marked as dangerous", () => {
    const tool = createDangerousTool({
      name: "dangerous_tool",
      description: "dangerous",
      inputSchema: { type: "object", properties: {} },
    });
    expect(tool.dangerLevel).toBe(DangerLevel.dangerous);
  });
});

describe("Tool Helpers Integration", () => {
  test("createSafeTool and createDangerousTool return different dangerLevel", () => {
    const safeTool = createSafeTool({
      name: "safe",
      description: "safe",
      inputSchema: { type: "object", properties: {} },
    });
    const dangerousTool = createDangerousTool({
      name: "dangerous",
      description: "dangerous",
      inputSchema: { type: "object", properties: {} },
    });
    expect(safeTool.dangerLevel).not.toBe(dangerousTool.dangerLevel);
  });

  test("Both tool helpers return objects with consistent structure", () => {
    const safeTool = createSafeTool({
      name: "safe_tool",
      description: "A safe tool",
      inputSchema: { type: "object", properties: {} },
    });
    const dangerousTool = createDangerousTool({
      name: "dangerous_tool",
      description: "A dangerous tool",
      inputSchema: { type: "object", properties: {} },
    });

    expect(safeTool).toHaveProperty("name");
    expect(safeTool).toHaveProperty("description");
    expect(safeTool).toHaveProperty("input_schema");
    expect(safeTool).toHaveProperty("dangerLevel");

    expect(dangerousTool).toHaveProperty("name");
    expect(dangerousTool).toHaveProperty("description");
    expect(dangerousTool).toHaveProperty("input_schema");
    expect(dangerousTool).toHaveProperty("dangerLevel");
  });
});

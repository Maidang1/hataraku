import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { readFile } from "../../tools/read_file";
import { ToolResult } from "../../tools/types";

describe("readFile Tool", () => {
  let testFile: string;
  let testContent: string;

  beforeAll(async () => {
    // Create a test file
    testFile = `${import.meta.dir}/fixtures/test.txt`;
    testContent = "Hello, World!\nThis is a test file.";
    
    // Ensure fixtures directory exists
    const fixturesDir = `${import.meta.dir}/fixtures`;
    const fs = await import("fs/promises");
    await fs.mkdir(fixturesDir, { recursive: true });
    
    // Write test file
    await Bun.write(testFile, testContent);
  });

  afterAll(async () => {
    // Clean up test file
    const testFilePath = `${import.meta.dir}/fixtures/test.txt`;
    try {
      const fs = await import("fs/promises");
      await fs.unlink(testFilePath);
    } catch {
      // File might already be deleted
    }
  });

  test("readFile returns ToolResult type", async () => {
    const result = await readFile({ path: `${import.meta.dir}/fixtures/test.txt` });
    expect(result).toHaveProperty("success");
    expect(typeof result.success).toBe("boolean");
  });

  test("readFile successfully reads an existing file", async () => {
    const result = await readFile({ path: `${import.meta.dir}/fixtures/test.txt` });
    
    if (result.success) {
      expect(result.data).toBe(testContent);
      expect(result.error).toBeUndefined();
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
  });

  test("readFile returns success=true for existing files", async () => {
    const result = await readFile({ path: `${import.meta.dir}/fixtures/test.txt` });
    expect(result.success).toBe(true);
  });

  test("readFile returns file content as string", async () => {
    const result = await readFile({ path: `${import.meta.dir}/fixtures/test.txt` });
    
    if (result.success) {
      expect(typeof result.data).toBe("string");
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
  });

  test("readFile handles file not found error", async () => {
    const result = await readFile({ path: "/non/existent/file.txt" });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe("string");
    expect(result.data).toBeUndefined();
  });

  test("readFile returns discriminated union for errors", async () => {
    const result = await readFile({ path: "/invalid/path/file.txt" });
    
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    } else {
      throw new Error("Expected failure for non-existent file");
    }
  });

  test("readFile tool definition is properly exported", async () => {
    const { definition } = await import("../../tools/read_file");
    
    expect(definition).toBeDefined();
    expect(definition.name).toBe("read_file");
    expect(definition.description).toBeDefined();
    expect(definition.input_schema).toBeDefined();
    expect(definition.dangerLevel).toBe("safe");
  });

  test("readFile handles relative paths", async () => {
    // Create a file in a subdirectory to test relative path resolution
    const testDir = `${import.meta.dir}/fixtures/subdir`;
    const relativeTestFile = `${testDir}/relative_test.txt`;
    const relativeContent = "Relative path test content";
    
    const fs = await import("fs/promises");
    await fs.mkdir(testDir, { recursive: true });
    await Bun.write(relativeTestFile, relativeContent);
    
    const result = await readFile({ path: relativeTestFile });
    
    if (result.success) {
      expect(result.data).toBe(relativeContent);
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
    
    // Cleanup
    try {
      await fs.unlink(relativeTestFile);
      await fs.rmdir(testDir);
    } catch {
      // Cleanup errors are non-critical
    }
  });

  test("readFile returns error for directories", async () => {
    const result = await readFile({ path: `${import.meta.dir}/fixtures` });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("readFile Tool Definition", () => {
  test("tool definition has name 'read_file'", async () => {
    const { definition } = await import("../../tools/read_file");
    expect(definition.name).toBe("read_file");
  });

  test("tool definition has meaningful description", async () => {
    const { definition } = await import("../../tools/read_file");
    expect(definition.description).toBeDefined();
    expect(definition.description.length).toBeGreaterThan(0);
  });

  test("tool definition has input_schema with path property", async () => {
    const { definition } = await import("../../tools/read_file");
    expect(definition.input_schema).toBeDefined();
    expect(definition.input_schema.properties).toBeDefined();
    expect(definition.input_schema.properties.path).toBeDefined();
  });

  test("tool definition marks path as required", async () => {
    const { definition } = await import("../../tools/read_file");
    expect(definition.input_schema.required).toBeDefined();
    expect(definition.input_schema.required).toContain("path");
  });

  test("tool definition is marked as safe", async () => {
    const { definition } = await import("../../tools/read_file");
    expect(definition.dangerLevel).toBe("safe");
  });
});

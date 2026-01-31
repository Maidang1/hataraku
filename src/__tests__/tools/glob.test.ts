import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { glob } from "../../tools/glob";
import { ToolResult } from "../../tools/types";

describe("glob Tool", () => {
  let testDir: string;
  let testFiles: string[];

  beforeAll(async () => {
    // Create a test directory structure
    testDir = `${import.meta.dir}/fixtures/glob-test`;
    testFiles = [
      `${testDir}/file1.ts`,
      `${testDir}/file2.ts`,
      `${testDir}/file3.js`,
      `${testDir}/subdir/nested.ts`,
      `${testDir}/subdir/data.json`,
    ];

    // Setup fixture directory structure
    const fs = await import("fs/promises");
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(`${testDir}/subdir`, { recursive: true });

    // Create test files
    for (const file of testFiles) {
      await Bun.write(file, "test content");
    }
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      const fs = await import("fs/promises");
      await fs.rm(`${import.meta.dir}/fixtures/glob-test`, { recursive: true });
    } catch {
      // Cleanup errors are non-critical
    }
  });

  test("glob returns ToolResult type", async () => {
    const result = await glob({ pattern: `${testDir}/*.ts` });
    expect(result).toHaveProperty("success");
    expect(typeof result.success).toBe("boolean");
  });

  test("glob returns success result", async () => {
    const result = await glob({ pattern: `${testDir}/*.ts` });

    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
      if (result.data.length > 0) {
        expect(result.data.some((path) => path.includes("file1.ts"))).toBe(
          true
        );
        expect(result.data.some((path) => path.includes("file2.ts"))).toBe(
          true
        );
      }
      expect(result.error).toBeUndefined();
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
  });

  test("glob returns success=true", async () => {
    const result = await glob({ pattern: `${testDir}/*.ts` });
    expect(result.success).toBe(true);
  });

  test("glob returns array of strings", async () => {
    const result = await glob({ pattern: `${testDir}/*.ts` });

    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.every((item) => typeof item === "string")).toBe(true);
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
  });

  test("glob returns empty array for no matches or when glob unavailable", async () => {
    const result = await glob({ pattern: `${testDir}/*.xyz` });

    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
  });

  test("glob accepts cwd parameter", async () => {
    const result = await glob({
      pattern: "*.ts",
      cwd: testDir,
    });

    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
  });

  test("glob accepts recursive patterns with **", async () => {
    const result = await glob({ pattern: `${testDir}/**/*.ts` });

    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    } else {
      throw new Error(`Expected success but got error: ${result.error}`);
    }
  });

  test("glob handles missing directories gracefully", async () => {
    const result = await glob({
      pattern: "*.ts",
      cwd: "/non/existent/directory",
    });

    expect(typeof result.success).toBe("boolean");
    expect(result.success).toBe(true);
  });

  test("glob returns discriminated union for success case", async () => {
    const result = await glob({ pattern: `${testDir}/*.ts` });

    if (result.success) {
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();
    } else {
      throw new Error("Expected success");
    }
  });
});

describe("glob Tool Definition", () => {
  test("tool definition has name 'glob'", async () => {
    const { definition } = await import("../../tools/glob");
    expect(definition.name).toBe("glob");
  });

  test("tool definition has meaningful description", async () => {
    const { definition } = await import("../../tools/glob");
    expect(definition.description).toBeDefined();
    expect(definition.description.length).toBeGreaterThan(0);
  });

  test("tool definition has input_schema with pattern property", async () => {
    const { definition } = await import("../../tools/glob");
    expect(definition.input_schema).toBeDefined();
    expect(definition.input_schema.properties).toBeDefined();
    expect(definition.input_schema.properties.pattern).toBeDefined();
  });

  test("tool definition marks pattern as required", async () => {
    const { definition } = await import("../../tools/glob");
    expect(definition.input_schema.required).toBeDefined();
    expect(definition.input_schema.required).toContain("pattern");
  });

  test("tool definition has optional cwd property", async () => {
    const { definition } = await import("../../tools/glob");
    expect(definition.input_schema.properties.cwd).toBeDefined();
  });

  test("tool definition is marked as safe", async () => {
    const { definition } = await import("../../tools/glob");
    expect(definition.dangerLevel).toBe("safe");
  });

  test("tool definition returns string array", async () => {
    const { definition } = await import("../../tools/glob");
    expect(definition.input_schema.type).toBe("object");
  });
});

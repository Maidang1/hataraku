import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { editFile, definition } from "../../tools/edit_file";
import { DangerLevel } from "../../tools/types";

const TEST_DIR = "/tmp/claude-cli-test-edit";
const TEST_FILE = `${TEST_DIR}/test-edit.txt`;

describe("edit_file tool", () => {
  beforeEach(async () => {
    await Bun.$`mkdir -p ${TEST_DIR}`.quiet();
  });

  afterEach(async () => {
    await Bun.$`rm -rf ${TEST_DIR}`.quiet();
  });

  describe("definition", () => {
    test("has correct name", () => {
      expect(definition.name).toBe("edit_file");
    });

    test("has description", () => {
      expect(definition.description).toBeTruthy();
    });

    test("has input_schema", () => {
      expect(definition.input_schema).toBeDefined();
      expect(definition.input_schema.properties.path).toBeDefined();
      expect(definition.input_schema.properties.search).toBeDefined();
      expect(definition.input_schema.properties.replace).toBeDefined();
    });

    test("is marked as dangerous", () => {
      expect(definition.dangerLevel).toBe(DangerLevel.dangerous);
    });
  });

  describe("editFile function", () => {
    test("replaces search text with replace text", async () => {
      await Bun.write(TEST_FILE, "Hello World");

      const result = await editFile({
        path: TEST_FILE,
        search: "World",
        replace: "Universe",
      });

      expect(result.success).toBe(true);

      const content = await Bun.file(TEST_FILE).text();
      expect(content).toBe("Hello Universe");
    });

    test("returns error if search text not found", async () => {
      await Bun.write(TEST_FILE, "Hello World");

      const result = await editFile({
        path: TEST_FILE,
        search: "NotFound",
        replace: "Something",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    test("replaces all occurrences by default", async () => {
      await Bun.write(TEST_FILE, "foo bar foo baz foo");

      const result = await editFile({
        path: TEST_FILE,
        search: "foo",
        replace: "qux",
      });

      expect(result.success).toBe(true);

      const content = await Bun.file(TEST_FILE).text();
      expect(content).toBe("qux bar qux baz qux");
    });

    test("handles multiline content", async () => {
      await Bun.write(TEST_FILE, "Line 1\nLine 2\nLine 3");

      const result = await editFile({
        path: TEST_FILE,
        search: "Line 2",
        replace: "Modified Line",
      });

      expect(result.success).toBe(true);

      const content = await Bun.file(TEST_FILE).text();
      expect(content).toBe("Line 1\nModified Line\nLine 3");
    });

    test("returns error if file doesn't exist", async () => {
      const result = await editFile({
        path: "/nonexistent/file.txt",
        search: "text",
        replace: "new",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test("handles empty replacement", async () => {
      await Bun.write(TEST_FILE, "Remove this text");

      const result = await editFile({
        path: TEST_FILE,
        search: " this",
        replace: "",
      });

      expect(result.success).toBe(true);

      const content = await Bun.file(TEST_FILE).text();
      expect(content).toBe("Remove text");
    });

    test("reports number of replacements", async () => {
      await Bun.write(TEST_FILE, "test test test");

      const result = await editFile({
        path: TEST_FILE,
        search: "test",
        replace: "pass",
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain("3");
    });
  });
});

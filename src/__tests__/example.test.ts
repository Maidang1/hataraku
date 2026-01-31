import { test, expect, describe } from "bun:test";

describe("Test Infrastructure", () => {
  test("basic arithmetic", () => {
    expect(2 + 2).toBe(4);
  });

  test("string operations", () => {
    const greeting = "Hello, Bun!";
    expect(greeting).toContain("Bun");
  });

  test("array operations", () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr[0]).toBe(1);
  });
});

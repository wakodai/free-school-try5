import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getEnv, getOptionalEnv } from "./env";

describe("getEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("環境変数が設定されている場合はその値を返す", () => {
    process.env.TEST_VAR = "test_value";
    expect(getEnv("TEST_VAR")).toBe("test_value");
  });

  it("環境変数が未設定の場合はエラーをスローする", () => {
    delete process.env.NONEXISTENT_VAR;
    expect(() => getEnv("NONEXISTENT_VAR")).toThrow(
      "Environment variable NONEXISTENT_VAR is required but not set.",
    );
  });

  it("環境変数が空文字の場合はエラーをスローする", () => {
    process.env.EMPTY_VAR = "";
    expect(() => getEnv("EMPTY_VAR")).toThrow(
      "Environment variable EMPTY_VAR is required but not set.",
    );
  });
});

describe("getOptionalEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("環境変数が設定されている場合はその値を返す", () => {
    process.env.TEST_VAR = "test_value";
    expect(getOptionalEnv("TEST_VAR")).toBe("test_value");
  });

  it("環境変数が未設定の場合はundefinedを返す", () => {
    delete process.env.NONEXISTENT_VAR;
    expect(getOptionalEnv("NONEXISTENT_VAR")).toBeUndefined();
  });

  it("環境変数が未設定でフォールバックが指定されている場合はフォールバックを返す", () => {
    delete process.env.NONEXISTENT_VAR;
    expect(getOptionalEnv("NONEXISTENT_VAR", "default")).toBe("default");
  });

  it("環境変数が空文字の場合はフォールバックを返す", () => {
    process.env.EMPTY_VAR = "";
    expect(getOptionalEnv("EMPTY_VAR", "default")).toBe("default");
  });

  it("環境変数が設定されている場合はフォールバックを無視する", () => {
    process.env.TEST_VAR = "actual";
    expect(getOptionalEnv("TEST_VAR", "default")).toBe("actual");
  });
});

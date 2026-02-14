import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  badRequestFromZod,
  jsonError,
  notFound,
  internalServerError,
  conflict,
} from "./http";

describe("badRequestFromZod", () => {
  it("ZodErrorからバリデーションエラーレスポンスを生成する", async () => {
    const schema = z.object({ name: z.string().min(1, "名前は必須です。") });
    const result = schema.safeParse({ name: "" });
    if (result.success) throw new Error("should fail");

    const response = badRequestFromZod(result.error);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("入力値が不正です。");
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].path).toBe("name");
    expect(body.issues[0].message).toBe("名前は必須です。");
  });

  it("複数のバリデーションエラーを返す", async () => {
    const schema = z.object({
      name: z.string().min(1, "名前は必須です。"),
      age: z.number({ message: "年齢は数値です。" }),
    });
    const result = schema.safeParse({ name: "", age: "not-a-number" });
    if (result.success) throw new Error("should fail");

    const response = badRequestFromZod(result.error);
    const body = await response.json();
    expect(body.issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("jsonError", () => {
  it("デフォルトで400ステータスを返す", async () => {
    const response = jsonError("エラーメッセージ");
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("エラーメッセージ");
  });

  it("カスタムステータスコードを設定できる", async () => {
    const response = jsonError("禁止", 403);
    expect(response.status).toBe(403);
  });
});

describe("notFound", () => {
  it("404ステータスとデフォルトメッセージを返す", async () => {
    const response = notFound();
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe("リソースが見つかりません。");
  });

  it("カスタムメッセージを設定できる", async () => {
    const response = notFound("保護者が見つかりません。");
    const body = await response.json();
    expect(body.error).toBe("保護者が見つかりません。");
  });
});

describe("internalServerError", () => {
  it("500ステータスとデフォルトメッセージを返す", async () => {
    const response = internalServerError();
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("サーバー内部エラーが発生しました。");
  });

  it("カスタムメッセージを設定できる", async () => {
    const response = internalServerError("DB接続に失敗しました。");
    const body = await response.json();
    expect(body.error).toBe("DB接続に失敗しました。");
  });
});

describe("conflict", () => {
  it("409ステータスとメッセージを返す", async () => {
    const response = conflict("重複しています。");
    expect(response.status).toBe(409);

    const body = await response.json();
    expect(body.error).toBe("重複しています。");
  });
});

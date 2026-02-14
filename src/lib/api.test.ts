import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";

// api.ts の apiFetch は直接エクスポートされていないため、
// 公開されたAPI関数を通してテストする
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiError", () => {
  it("status と url を保持する", () => {
    const err = new ApiError("テストエラー", 404, "/api/test");
    expect(err.message).toBe("テストエラー");
    expect(err.status).toBe(404);
    expect(err.url).toBe("/api/test");
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("listGuardians", () => {
  it("保護者一覧を取得できる", async () => {
    const guardians = [
      {
        id: "1",
        name: "山田太郎",
        phone: null,
        lineUserId: null,
        loginToken: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(guardians));

    // 動的インポートして fetch のモックが適用されるようにする
    const { listGuardians } = await import("./api");
    const result = await listGuardians();

    expect(result).toEqual(guardians);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/guardians",
      expect.objectContaining({
        cache: "no-store",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});

describe("fetchAttendance", () => {
  it("日付付きでクエリパラメータを送信する", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const { fetchAttendance } = await import("./api");
    await fetchAttendance({ date: "2026-02-14" });

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const calledUrl = lastCall[0] as string;
    expect(calledUrl).toContain("/api/attendance");
    expect(calledUrl).toContain("date=2026-02-14");
  });
});

describe("postMessage", () => {
  it("メッセージを送信できる", async () => {
    const created = {
      id: "msg-1",
      guardianId: "g-1",
      studentId: null,
      direction: "outbound",
      body: "テスト",
      createdAt: "2026-02-14T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(created));

    const { postMessage } = await import("./api");
    const result = await postMessage({
      guardianId: "g-1",
      direction: "outbound",
      body: "テスト",
    });

    expect(result).toEqual(created);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          guardianId: "g-1",
          direction: "outbound",
          body: "テスト",
        }),
      }),
    );
  });
});

describe("エラーハンドリング", () => {
  it("APIエラー時にerrorフィールドのメッセージを使用する", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "保護者が見つかりません" }, 404),
    );

    const { listGuardians } = await import("./api");
    await expect(listGuardians()).rejects.toThrow("保護者が見つかりません");
  });

  it("APIエラー時にmessageフィールドのメッセージを使用する", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: "バリデーションエラー" }, 400),
    );

    const { listGuardians } = await import("./api");
    await expect(listGuardians()).rejects.toThrow("バリデーションエラー");
  });

  it("エラーメッセージが無い場合はステータスコードを表示する", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

    const { listGuardians } = await import("./api");
    await expect(listGuardians()).rejects.toThrow(
      "リクエストに失敗しました (500)",
    );
  });

  it("ネットワークエラー時に接続エラーメッセージを返す", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const { listGuardians } = await import("./api");
    await expect(listGuardians()).rejects.toThrow(
      "サーバーに接続できませんでした",
    );
  });

  it("ApiError にステータスコードとURLが含まれる", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "エラー" }, 403),
    );

    const { listGuardians } = await import("./api");
    try {
      await listGuardians();
      expect.fail("エラーが発生するはず");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as InstanceType<typeof ApiError>;
      expect(apiErr.status).toBe(403);
      expect(apiErr.url).toBe("/api/guardians");
    }
  });
});

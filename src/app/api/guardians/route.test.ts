import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/guardians", () => {
  it("保護者一覧を取得できる", async () => {
    const guardians = [
      {
        id: "uuid-1",
        name: "山田太郎",
        phone: "090-1234-5678",
        line_user_id: null,
        login_token: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: guardians,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("山田太郎");
    expect(body[0].lineUserId).toBeNull();
  });

  it("Supabaseエラー時は500を返す", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    const response = await GET();
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe("保護者一覧の取得に失敗しました。");
  });
});

describe("POST /api/guardians", () => {
  it("保護者を登録できる", async () => {
    const guardian = {
      id: "uuid-1",
      name: "山田太郎",
      phone: null,
      line_user_id: null,
      login_token: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: guardian,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/guardians", {
      method: "POST",
      body: JSON.stringify({ name: "山田太郎" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("山田太郎");
  });

  it("名前が空の場合は400を返す", async () => {
    const request = new NextRequest("http://localhost/api/guardians", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("入力値が不正です。");
  });

  it("重複時は409を返す", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/guardians", {
      method: "POST",
      body: JSON.stringify({ name: "山田太郎", lineUserId: "U123" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });

  it("不正なJSONボディの場合は400を返す", async () => {
    const request = new NextRequest("http://localhost/api/guardians", {
      method: "POST",
      body: "invalid json",
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

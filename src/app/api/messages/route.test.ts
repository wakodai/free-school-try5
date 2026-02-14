import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}));

import { GET, POST } from "./route";

const validUuid = "46a8a6b3-1dd6-4d4f-8a5a-548d9a5c1234";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/messages", () => {
  it("メッセージ一覧を取得できる", async () => {
    const messages = [
      {
        id: "msg-1",
        guardian_id: validUuid,
        student_id: null,
        direction: "inbound",
        body: "テストメッセージ",
        created_at: "2026-01-01T00:00:00Z",
        guardian: { id: validUuid, name: "山田太郎", phone: null },
        student: null,
      },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    chain.order.mockResolvedValue({ data: messages, error: null });
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/messages");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].body).toBe("テストメッセージ");
    expect(body[0].direction).toBe("inbound");
  });

  it("guardianIdで絞り込みできる", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest(
      `http://localhost/api/messages?guardianId=${validUuid}`,
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(chain.eq).toHaveBeenCalledWith("guardian_id", validUuid);
  });

  it("無効なguardianIdは400を返す", async () => {
    const request = new NextRequest(
      "http://localhost/api/messages?guardianId=invalid",
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
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

    const request = new NextRequest("http://localhost/api/messages");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

describe("POST /api/messages", () => {
  it("メッセージを保存できる", async () => {
    const message = {
      id: "msg-1",
      guardian_id: validUuid,
      student_id: null,
      direction: "inbound",
      body: "テストメッセージ",
      created_at: "2026-01-01T00:00:00Z",
      guardian: { id: validUuid, name: "山田太郎", phone: null },
      student: null,
    };

    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: message,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        guardianId: validUuid,
        direction: "inbound",
        body: "テストメッセージ",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.body).toBe("テストメッセージ");
  });

  it("空本文は400を返す", async () => {
    const request = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        guardianId: validUuid,
        direction: "inbound",
        body: "",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("外部キー違反時は400を返す", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23503", message: "foreign key violation" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        guardianId: validUuid,
        direction: "inbound",
        body: "テスト",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("存在しません");
  });

  it("Supabaseエラー時は500を返す", async () => {
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/messages", {
      method: "POST",
      body: JSON.stringify({
        guardianId: validUuid,
        direction: "inbound",
        body: "テスト",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});

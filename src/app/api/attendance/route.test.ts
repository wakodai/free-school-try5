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
const validUuid2 = "de9fb648-0a39-4bb8-8a8e-5f9273ed1234";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/attendance", () => {
  it("日付指定で出欠一覧を取得できる", async () => {
    const attendances = [
      {
        id: "att-1",
        guardian_id: validUuid,
        student_id: validUuid2,
        requested_for: "2026-02-14",
        status: "present",
        reason: null,
        created_at: "2026-01-01T00:00:00Z",
        guardian: { id: validUuid, name: "山田太郎", phone: null },
        student: { id: validUuid2, name: "山田花子", grade: "小3" },
      },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({
        data: attendances,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest(
      "http://localhost/api/attendance?date=2026-02-14",
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("present");
    expect(body[0].guardian.name).toBe("山田太郎");
  });

  it("日付もfrom/toも未指定なら400を返す", async () => {
    const request = new NextRequest("http://localhost/api/attendance");
    const response = await GET(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("date もしくは from/to");
  });

  it("不正な日付フォーマットは400を返す", async () => {
    const request = new NextRequest(
      "http://localhost/api/attendance?date=invalid",
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("Supabaseエラー時は500を返す", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest(
      "http://localhost/api/attendance?date=2026-02-14",
    );
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

describe("POST /api/attendance", () => {
  it("出欠を登録できる", async () => {
    const attendance = {
      id: "att-1",
      guardian_id: validUuid,
      student_id: validUuid2,
      requested_for: "2026-02-14",
      status: "present",
      reason: null,
      created_at: "2026-01-01T00:00:00Z",
      guardian: { id: validUuid, name: "山田太郎", phone: null },
      student: { id: validUuid2, name: "山田花子", grade: "小3" },
    };

    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: attendance,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        guardianId: validUuid,
        studentId: validUuid2,
        requestedFor: "2026-02-14",
        status: "present",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("present");
    expect(body.requestedFor).toBe("2026-02-14");
  });

  it("バリデーションエラー時は400を返す", async () => {
    const request = new NextRequest("http://localhost/api/attendance", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("外部キー違反時は400を返す", async () => {
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23503", message: "foreign key violation" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        guardianId: validUuid,
        studentId: validUuid2,
        requestedFor: "2026-02-14",
        status: "present",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toContain("存在しません");
  });

  it("重複エラー時は409を返す", async () => {
    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "unique violation" },
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        guardianId: validUuid,
        studentId: validUuid2,
        requestedFor: "2026-02-14",
        status: "present",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
  });
});

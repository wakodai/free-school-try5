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

describe("GET /api/students", () => {
  it("児童一覧を取得できる", async () => {
    const students = [
      {
        id: "uuid-1",
        name: "山田花子",
        grade: "小3",
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: students,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/students");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("山田花子");
    expect(body[0].grade).toBe("小3");
  });

  it("guardianIdで絞り込みできる", async () => {
    const guardianId = "46a8a6b3-1dd6-4d4f-8a5a-548d9a5c1234";
    const students = [
      {
        student: {
          id: "uuid-1",
          name: "山田花子",
          grade: "小3",
          notes: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: students,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest(
      `http://localhost/api/students?guardianId=${guardianId}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("山田花子");
  });

  it("無効なguardianIdは400を返す", async () => {
    const request = new NextRequest(
      "http://localhost/api/students?guardianId=invalid",
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

    const request = new NextRequest("http://localhost/api/students");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

describe("POST /api/students", () => {
  it("児童を登録できる", async () => {
    const student = {
      id: "uuid-1",
      name: "山田花子",
      grade: "小3",
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: student,
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const request = new NextRequest("http://localhost/api/students", {
      method: "POST",
      body: JSON.stringify({ name: "山田花子", grade: "小3" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("山田花子");
    expect(body.grade).toBe("小3");
  });

  it("名前が空なら400を返す", async () => {
    const request = new NextRequest("http://localhost/api/students", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
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

    const request = new NextRequest("http://localhost/api/students", {
      method: "POST",
      body: JSON.stringify({ name: "山田花子" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it("保護者紐付けの外部キーエラー時は400を返す", async () => {
    const student = {
      id: "uuid-1",
      name: "山田花子",
      grade: null,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: student,
            error: null,
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({
          error: { code: "23503", message: "foreign key violation" },
        }),
      };
    });

    const request = new NextRequest("http://localhost/api/students", {
      method: "POST",
      body: JSON.stringify({
        name: "山田花子",
        guardianId: "46a8a6b3-1dd6-4d4f-8a5a-548d9a5c1234",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("指定の保護者が存在しません。");
  });
});

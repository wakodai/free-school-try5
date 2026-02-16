import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

function buildChain(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data, error }),
  };
}

function buildChainNoFilter(data: unknown[], error: unknown = null) {
  // When no date filters are applied, order() resolves directly
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

describe("GET /api/attendance/stats", () => {
  it("日付指定で統計を取得できる", async () => {
    const rows = [
      { status: "present", requested_for: "2026-02-14", student_id: "s1", student: { id: "s1", name: "田中太郎", grade: "小3" } },
      { status: "absent", requested_for: "2026-02-14", student_id: "s2", student: { id: "s2", name: "鈴木花子", grade: "小4" } },
    ];
    mockFrom.mockReturnValue(buildChain(rows));

    const request = new NextRequest("http://localhost/api/attendance/stats?date=2026-02-14");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overall.present).toBe(1);
    expect(body.overall.absent).toBe(1);
    expect(body.overall.total).toBe(2);
    expect(body.byStudent).toHaveLength(2);
  });

  it("from/to 指定で範囲統計を取得できる", async () => {
    const rows = [
      { status: "present", requested_for: "2026-02-01", student_id: "s1", student: { id: "s1", name: "田中太郎", grade: "小3" } },
      { status: "late", requested_for: "2026-02-02", student_id: "s1", student: { id: "s1", name: "田中太郎", grade: "小3" } },
    ];
    mockFrom.mockReturnValue(buildChain(rows));

    const request = new NextRequest("http://localhost/api/attendance/stats?from=2026-02-01&to=2026-02-28");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overall.present).toBe(1);
    expect(body.overall.late).toBe(1);
    expect(body.overall.total).toBe(2);
    expect(body.byStudent).toHaveLength(1);
    expect(body.byStudent[0].student.name).toBe("田中太郎");
  });

  it("日付未指定で全期間の統計を取得できる", async () => {
    const rows = [
      { status: "present", requested_for: "2025-01-10", student_id: "s1", student: { id: "s1", name: "田中太郎", grade: "小3" } },
      { status: "present", requested_for: "2026-02-14", student_id: "s1", student: { id: "s1", name: "田中太郎", grade: "小3" } },
      { status: "absent", requested_for: "2026-02-14", student_id: "s2", student: { id: "s2", name: "鈴木花子", grade: "小4" } },
    ];
    mockFrom.mockReturnValue(buildChainNoFilter(rows));

    const request = new NextRequest("http://localhost/api/attendance/stats");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.overall.total).toBe(3);
    expect(body.overall.present).toBe(2);
    expect(body.overall.absent).toBe(1);
    expect(body.range.from).toBeNull();
    expect(body.range.to).toBeNull();
  });

  it("不正な日付フォーマットは400を返す", async () => {
    const request = new NextRequest("http://localhost/api/attendance/stats?date=invalid");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("Supabaseエラー時は500を返す", async () => {
    mockFrom.mockReturnValue(buildChainNoFilter([], { message: "DB error" }));

    const request = new NextRequest("http://localhost/api/attendance/stats");
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { badRequestFromZod, internalServerError, jsonError } from "@/lib/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { statsQuerySchema } from "@/lib/validators";

type AttendanceRow = Database["public"]["Tables"]["attendance_requests"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

type StatusBuckets = {
  present: number;
  absent: number;
  late: number;
  unknown: number;
  total: number;
};

function emptyBuckets(): StatusBuckets {
  return { present: 0, absent: 0, late: 0, unknown: 0, total: 0 };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = statsQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const rangeFrom = parsed.data.date ?? parsed.data.from;
    const rangeTo = parsed.data.date ?? parsed.data.to;

    const supabase = getSupabaseServerClient() as any;
    let query = supabase
      .from("attendance_requests")
      .select("status, requested_for, student_id, student:students(id, name, grade)")
      .order("requested_for", { ascending: true });

    if (rangeFrom) {
      query = query.gte("requested_for", rangeFrom);
    }
    if (rangeTo) {
      query = query.lte("requested_for", rangeTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error("出欠統計取得エラー:", error.message);
      return jsonError("出欠統計の取得に失敗しました。", 500);
    }

    const rows = (data ?? []) as Array<AttendanceRow & { student?: StudentRow | null }>;
    const overall = emptyBuckets();
    const byStudent = new Map<
      string,
      StatusBuckets & { student: Pick<StudentRow, "id" | "name" | "grade"> }
    >();

    rows.forEach((row) => {
      const studentId = row.student_id;
      const existing =
        byStudent.get(studentId) ??
        (() => {
          const next = {
            ...emptyBuckets(),
            student: {
              id: studentId,
              name: row.student?.name ?? "未登録の児童",
              grade: row.student?.grade ?? null,
            },
          };
          byStudent.set(studentId, next);
          return next;
        })();

      existing[row.status] += 1;
      existing.total += 1;

      overall[row.status] += 1;
      overall.total += 1;
    });

    return NextResponse.json({
      range: { from: rangeFrom ?? null, to: rangeTo ?? null },
      overall,
      byStudent: Array.from(byStudent.values()),
    });
  } catch (err) {
    console.error("出欠統計取得で予期しないエラー:", err);
    return internalServerError();
  }
}

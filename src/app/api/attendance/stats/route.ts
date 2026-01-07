import { NextResponse, type NextRequest } from "next/server";
import { badRequestFromZod, jsonError } from "@/lib/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { statsQuerySchema } from "@/lib/validators";

type AttendanceRow = Database["public"]["Tables"]["attendance_requests"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

interface AggregatedRow {
  studentId: string;
  studentName?: string;
  grade?: string | null;
  present: number;
  absent: number;
  late: number;
  unknown: number;
  total: number;
}

export async function GET(req: NextRequest) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = statsQuerySchema.safeParse(searchParams);

  if (!parsed.success) {
    return badRequestFromZod(parsed.error);
  }

  const supabase = getSupabaseServerClient();
  let query = supabase
    .from("attendance_requests")
    .select("student_id, status, student:students(id, name, grade)");

  const { from, to, date } = parsed.data;
  const rangeFrom = date ?? from;
  const rangeTo = date ?? to;

  if (rangeFrom) {
    query = query.gte("requested_for", rangeFrom);
  }
  if (rangeTo) {
    query = query.lte("requested_for", rangeTo);
  }

  const { data, error, status } = await query;

  if (error || !data) {
    return jsonError(
      `出欠統計の取得に失敗しました: ${error?.message ?? "unknown"}`,
      status || 500,
    );
  }

  const byStudent = new Map<string, AggregatedRow>();
  const overall = {
    present: 0,
    absent: 0,
    late: 0,
    unknown: 0,
    total: 0,
  };

  data.forEach((row) => {
    const student = (row as unknown as AttendanceRow & {
      student?: StudentRow | null;
    }).student;
    const key = row.student_id;

    if (!byStudent.has(key)) {
      byStudent.set(key, {
        studentId: key,
        studentName: student?.name ?? undefined,
        grade: student?.grade,
        present: 0,
        absent: 0,
        late: 0,
        unknown: 0,
        total: 0,
      });
    }

    const target = byStudent.get(key)!;
    target.total += 1;
    overall.total += 1;

    if (row.status === "present") {
      target.present += 1;
      overall.present += 1;
    } else if (row.status === "absent") {
      target.absent += 1;
      overall.absent += 1;
    } else if (row.status === "late") {
      target.late += 1;
      overall.late += 1;
    } else {
      target.unknown += 1;
      overall.unknown += 1;
    }
  });

  const byStudentList = Array.from(byStudent.values()).sort((a, b) => {
    if (a.studentName && b.studentName) {
      return a.studentName.localeCompare(b.studentName, "ja");
    }
    return a.studentId.localeCompare(b.studentId);
  });

  return NextResponse.json({
    range: {
      from: rangeFrom ?? null,
      to: rangeTo ?? null,
    },
    byStudent: byStudentList,
    overall,
  });
}

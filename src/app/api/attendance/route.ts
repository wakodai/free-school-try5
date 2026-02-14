/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { badRequestFromZod, conflict, internalServerError, jsonError } from "@/lib/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  attendanceQuerySchema,
  createAttendanceSchema,
} from "@/lib/validators";

type AttendanceRow = Database["public"]["Tables"]["attendance_requests"]["Row"];
type GuardianRow = Database["public"]["Tables"]["guardians"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

function mapAttendance(
  row: AttendanceRow & {
    guardian?: GuardianRow | null;
    student?: StudentRow | null;
  },
) {
  return {
    id: row.id,
    guardianId: row.guardian_id,
    studentId: row.student_id,
    requestedFor: row.requested_for,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    guardian: row.guardian
      ? {
          id: row.guardian.id,
          name: row.guardian.name,
          phone: row.guardian.phone,
        }
      : undefined,
    student: row.student
      ? {
          id: row.student.id,
          name: row.student.name,
          grade: row.student.grade,
        }
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = attendanceQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const rangeFrom = parsed.data.date ?? parsed.data.from;
    const rangeTo = parsed.data.date ?? parsed.data.to;

    if (!rangeFrom && !rangeTo) {
      return jsonError("date もしくは from/to のいずれかを指定してください。", 400);
    }

    const supabase = getSupabaseServerClient() as any;
    let query = supabase
      .from("attendance_requests")
      .select(
        "*, guardian:guardians(id, name, phone), student:students(id, name, grade)",
      )
      .order("requested_for", { ascending: true })
      .order("student_id", { ascending: true });

    if (rangeFrom) {
      query = query.gte("requested_for", rangeFrom);
    }
    if (rangeTo) {
      query = query.lte("requested_for", rangeTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error("出欠一覧取得エラー:", error.message);
      return jsonError("出欠一覧の取得に失敗しました。", 500);
    }

    return NextResponse.json((data ?? []).map(mapAttendance));
  } catch (err) {
    console.error("出欠一覧取得で予期しないエラー:", err);
    return internalServerError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = createAttendanceSchema.safeParse(body);

    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const supabase = getSupabaseServerClient() as any;
    const { data, error } = await supabase
      .from("attendance_requests")
      .upsert(
        [
          {
            guardian_id: parsed.data.guardianId,
            student_id: parsed.data.studentId,
            requested_for: parsed.data.requestedFor,
            status: parsed.data.status,
            reason: parsed.data.reason ?? null,
          },
        ],
        { onConflict: "student_id,requested_for" },
      )
      .select(
        "*, guardian:guardians(id, name, phone), student:students(id, name, grade)",
      )
      .single();

    if (error) {
      if (error.code === "23503") {
        return jsonError("guardianId または studentId が存在しません。", 400);
      }
      if (error.code === "23505") {
        return conflict("同じ児童と日付の出欠が既に存在し、更新に失敗しました。");
      }
      console.error("出欠登録エラー:", error.message);
      return jsonError("出欠の登録に失敗しました。", 500);
    }

    return NextResponse.json(mapAttendance(data));
  } catch (err) {
    console.error("出欠登録で予期しないエラー:", err);
    return internalServerError();
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { badRequestFromZod, internalServerError, jsonError } from "@/lib/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { createStudentSchema, uuidSchema } from "@/lib/validators";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];

function mapStudent(row: StudentRow) {
  return {
    id: row.id,
    name: row.name,
    grade: row.grade,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient() as any;
    const search = req.nextUrl.searchParams;
    const guardianId = search.get("guardianId");

    if (guardianId) {
      const parsedGuardian = uuidSchema.safeParse(guardianId);
      if (!parsedGuardian.success) {
        return badRequestFromZod(parsedGuardian.error);
      }

      const { data, error } = await supabase
        .from("guardian_students")
        .select("student:students(*)")
        .eq("guardian_id", parsedGuardian.data);

      if (error) {
        console.error("児童一覧取得エラー:", error.message);
        return jsonError("児童一覧の取得に失敗しました。", 500);
      }

      const rows = (data ?? []) as Array<{ student: StudentRow | null }>;
      return NextResponse.json(
        rows
          .map((record) => record.student)
          .filter(Boolean)
          .map((student) => mapStudent(student as StudentRow)),
      );
    }

    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("児童一覧取得エラー:", error.message);
      return jsonError("児童一覧の取得に失敗しました。", 500);
    }

    return NextResponse.json((data ?? []).map(mapStudent));
  } catch (err) {
    console.error("児童一覧取得で予期しないエラー:", err);
    return internalServerError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = createStudentSchema.safeParse(body);

    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const supabase = getSupabaseServerClient() as any;

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        name: parsed.data.name,
        grade: parsed.data.grade ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select()
      .single();

    if (studentError || !student) {
      console.error("児童登録エラー:", studentError?.message);
      return jsonError("児童の登録に失敗しました。", 500);
    }

    if (parsed.data.guardianId) {
      const { error: linkError } = await supabase
        .from("guardian_students")
        .insert({
          guardian_id: parsed.data.guardianId,
          student_id: student.id,
        });

      if (linkError) {
        const errorMessage =
          linkError.code === "23503"
            ? "指定の保護者が存在しません。"
            : "児童と保護者の紐付けに失敗しました。";
        console.error("紐付けエラー:", linkError.message);
        return jsonError(errorMessage, 400);
      }
    }

    return NextResponse.json(mapStudent(student));
  } catch (err) {
    console.error("児童登録で予期しないエラー:", err);
    return internalServerError();
  }
}

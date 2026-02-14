/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { badRequestFromZod, internalServerError, jsonError } from "@/lib/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  createMessageSchema,
  messagesQuerySchema,
} from "@/lib/validators";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type GuardianRow = Database["public"]["Tables"]["guardians"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];

function mapMessage(
  row: MessageRow & {
    guardian?: GuardianRow | null;
    student?: StudentRow | null;
  },
) {
  return {
    id: row.id,
    guardianId: row.guardian_id,
    studentId: row.student_id,
    direction: row.direction,
    body: row.body,
    createdAt: row.created_at,
    guardian: row.guardian
      ? { id: row.guardian.id, name: row.guardian.name, phone: row.guardian.phone }
      : undefined,
    student: row.student
      ? { id: row.student.id, name: row.student.name, grade: row.student.grade }
      : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = messagesQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const supabase = getSupabaseServerClient() as any;
    let query = supabase
      .from("messages")
      .select(
        "*, guardian:guardians(id, name, phone), student:students(id, name, grade)",
      )
      .order("created_at", { ascending: false });

    if (parsed.data.guardianId) {
      query = query.eq("guardian_id", parsed.data.guardianId);
    }
    if (parsed.data.studentId) {
      query = query.eq("student_id", parsed.data.studentId);
    }
    if (parsed.data.direction) {
      query = query.eq("direction", parsed.data.direction);
    }

    const { data, error } = await query;
    if (error) {
      console.error("メッセージ取得エラー:", error.message);
      return jsonError("メッセージの取得に失敗しました。", 500);
    }

    return NextResponse.json((data ?? []).map(mapMessage));
  } catch (err) {
    console.error("メッセージ取得で予期しないエラー:", err);
    return internalServerError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = createMessageSchema.safeParse(body);

    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const supabase = getSupabaseServerClient() as any;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        guardian_id: parsed.data.guardianId,
        student_id: parsed.data.studentId ?? null,
        direction: parsed.data.direction,
        body: parsed.data.body,
      })
      .select(
        "*, guardian:guardians(id, name, phone), student:students(id, name, grade)",
      )
      .single();

    if (error) {
      if (error.code === "23503") {
        return jsonError("guardianId もしくは studentId が存在しません。", 400);
      }
      console.error("メッセージ保存エラー:", error.message);
      return jsonError("メッセージの保存に失敗しました。", 500);
    }

    return NextResponse.json(mapMessage(data));
  } catch (err) {
    console.error("メッセージ保存で予期しないエラー:", err);
    return internalServerError();
  }
}

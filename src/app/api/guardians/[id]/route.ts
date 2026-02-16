/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { internalServerError, jsonError, notFound } from "@/lib/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const parsed = uuidSchema.safeParse(id);
    if (!parsed.success) {
      return jsonError("無効な保護者IDです。", 400);
    }

    const supabase = getSupabaseServerClient() as any;

    // 保護者の存在確認
    const { data: existing, error: findError } = await supabase
      .from("guardians")
      .select("id")
      .eq("id", parsed.data)
      .single();

    if (findError || !existing) {
      return notFound("指定された保護者が見つかりません。");
    }

    // 紐づく生徒を取得して先に削除（生徒の CASCADE で出欠等も消える）
    const { data: links, error: linksError } = await supabase
      .from("guardian_students")
      .select("student_id")
      .eq("guardian_id", parsed.data);

    if (linksError) {
      console.error("紐づき取得エラー:", linksError.message);
      return jsonError("保護者の削除に失敗しました。", 500);
    }

    const studentIds = (links ?? []).map(
      (row: { student_id: string }) => row.student_id,
    );

    if (studentIds.length > 0) {
      const { error: studentsDeleteError } = await supabase
        .from("students")
        .delete()
        .in("id", studentIds);

      if (studentsDeleteError) {
        console.error("紐づく児童削除エラー:", studentsDeleteError.message);
        return jsonError("紐づく児童の削除に失敗しました。", 500);
      }
    }

    // 保護者を削除（残りの CASCADE で messages, line_flow_sessions 等も処理）
    const { error: deleteError } = await supabase
      .from("guardians")
      .delete()
      .eq("id", parsed.data);

    if (deleteError) {
      console.error("保護者削除エラー:", deleteError.message);
      return jsonError("保護者の削除に失敗しました。", 500);
    }

    return NextResponse.json({ success: true, deletedStudents: studentIds.length });
  } catch (err) {
    console.error("保護者削除で予期しないエラー:", err);
    return internalServerError();
  }
}

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
      return jsonError("無効な児童IDです。", 400);
    }

    const supabase = getSupabaseServerClient() as any;

    const { data: existing, error: findError } = await supabase
      .from("students")
      .select("id")
      .eq("id", parsed.data)
      .single();

    if (findError || !existing) {
      return notFound("指定された児童が見つかりません。");
    }

    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", parsed.data);

    if (deleteError) {
      console.error("児童削除エラー:", deleteError.message);
      return jsonError("児童の削除に失敗しました。", 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("児童削除で予期しないエラー:", err);
    return internalServerError();
  }
}

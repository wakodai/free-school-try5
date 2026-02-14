/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { badRequestFromZod, conflict, internalServerError, jsonError } from "@/lib/http";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { createGuardianSchema } from "@/lib/validators";

type GuardianRow = Database["public"]["Tables"]["guardians"]["Row"];

function mapGuardian(row: GuardianRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    lineUserId: row.line_user_id,
    loginToken: row.login_token,
    createdAt: row.created_at,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = createGuardianSchema.safeParse(body);

    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const supabase = getSupabaseServerClient() as any;
    const { data, error } = await supabase
      .from("guardians")
      .insert({
        name: parsed.data.name,
        phone: parsed.data.phone ?? null,
        line_user_id: parsed.data.lineUserId ?? null,
        login_token: parsed.data.loginToken ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return conflict("同じline_user_idもしくはlogin_tokenが既に存在します。");
      }
      console.error("保護者登録エラー:", error.message);
      return jsonError("保護者の登録に失敗しました。", 500);
    }

    return NextResponse.json(mapGuardian(data));
  } catch (err) {
    console.error("保護者登録で予期しないエラー:", err);
    return internalServerError();
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseServerClient() as any;
    const { data, error } = await supabase
      .from("guardians")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("保護者一覧取得エラー:", error.message);
      return jsonError("保護者一覧の取得に失敗しました。", 500);
    }

    return NextResponse.json((data ?? []).map(mapGuardian));
  } catch (err) {
    console.error("保護者一覧取得で予期しないエラー:", err);
    return internalServerError();
  }
}

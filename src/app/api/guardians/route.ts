/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { badRequestFromZod, jsonError } from "@/lib/http";
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
  const body = await req.json().catch(() => null);
  const parsed = createGuardianSchema.safeParse(body);

  if (!parsed.success) {
    return badRequestFromZod(parsed.error);
  }

  const supabase = getSupabaseServerClient() as any;
  const { data, error, status } = await supabase
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
      return jsonError("同じline_user_idもしくはlogin_tokenが既に存在します。", 409);
    }
    return jsonError(`ガーディアン登録に失敗しました: ${error.message}`, status || 500);
  }

  return NextResponse.json(mapGuardian(data));
}

export async function GET() {
  const supabase = getSupabaseServerClient() as any;
  const { data, error, status } = await supabase
    .from("guardians")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return jsonError(
      `ガーディアン一覧の取得に失敗しました: ${error?.message ?? "unknown"}`,
      status || 500,
    );
  }

  return NextResponse.json(data.map(mapGuardian));
}

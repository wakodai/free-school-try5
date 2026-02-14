import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function badRequestFromZod(error: ZodError) {
  return NextResponse.json(
    {
      error: "入力値が不正です。",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function notFound(message = "リソースが見つかりません。") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function internalServerError(message = "サーバー内部エラーが発生しました。") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

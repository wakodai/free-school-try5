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

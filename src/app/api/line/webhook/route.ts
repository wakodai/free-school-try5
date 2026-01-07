/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

const statusMap: Record<string, AttendanceStatus> = {
  出席: "present",
  欠席: "absent",
  遅刻: "late",
  未定: "unknown",
  present: "present",
  absent: "absent",
  late: "late",
  unknown: "unknown",
};

type ParsedAttendance = {
  status: AttendanceStatus;
  date: string;
  studentName: string;
  reason?: string;
};

function parseAttendanceCommand(text: string): ParsedAttendance | null {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^出欠\s+(出席|欠席|遅刻|未定|present|absent|late|unknown)\s+(\d{4}-\d{2}-\d{2})\s+(\S+)(?:\s+(.+))?$/i,
  );
  if (!match) return null;
  const [, statusLabelRaw, date, studentName, reasonRaw] = match;
  const statusKey = statusLabelRaw.toLowerCase();
  const status =
    statusMap[statusKey] ?? statusMap[statusLabelRaw as keyof typeof statusMap];
  if (!status) return null;
  return {
    status,
    date,
    studentName,
    reason: reasonRaw?.trim() || undefined,
  };
}

async function fetchLineProfileName(client: Client | null, userId: string) {
  if (!client) return null;
  try {
    const profile = await client.getProfile(userId);
    return profile?.displayName ?? null;
  } catch (err) {
    console.warn("Failed to fetch LINE profile", err);
    return null;
  }
}

async function getOrCreateGuardian(
  supabase: any,
  client: Client | null,
  userId: string,
) {
  const existing = await supabase
    .from("guardians")
    .select("*")
    .eq("line_user_id", userId)
    .single();
  if (existing.data) {
    return existing.data;
  }

  const displayName = await fetchLineProfileName(client, userId);
  const name = displayName ?? `LINEユーザー (${userId.slice(-6)})`;

  const inserted = await supabase
    .from("guardians")
    .insert({ name, line_user_id: userId })
    .select()
    .single();

  if (inserted.data) {
    return inserted.data;
  }

  if (inserted.error?.code === "23505") {
    const retry = await supabase
      .from("guardians")
      .select("*")
      .eq("line_user_id", userId)
      .single();
    if (retry.data) return retry.data;
  }

  throw new Error(
    `Failed to create guardian for LINE userId ${userId}: ${inserted.error?.message}`,
  );
}

async function findOrCreateStudent(
  supabase: any,
  guardianId: string,
  studentName: string,
) {
  const existing = await supabase
    .from("guardian_students")
    .select("student:students(*)")
    .eq("guardian_id", guardianId)
    .eq("student.name", studentName)
    .limit(1)
    .maybeSingle();

  const found = existing.data?.student;
  if (found) {
    return found;
  }

  const createdStudent = await supabase
    .from("students")
    .insert({ name: studentName })
    .select()
    .single();
  if (!createdStudent.data || createdStudent.error) {
    throw new Error(
      `Failed to create student ${studentName}: ${
        createdStudent.error?.message ?? "unknown"
      }`,
    );
  }

  const link = await supabase
    .from("guardian_students")
    .insert({
      guardian_id: guardianId,
      student_id: createdStudent.data.id,
    })
    .select()
    .single();

  if (link.error && link.error.code !== "23505") {
    console.warn("Failed to link guardian and student", link.error);
  }

  return createdStudent.data;
}

async function upsertAttendance(
  supabase: any,
  guardianId: string,
  studentId: string,
  parsed: ParsedAttendance,
) {
  const result = await supabase
    .from("attendance_requests")
    .upsert(
      [
        {
          guardian_id: guardianId,
          student_id: studentId,
          requested_for: parsed.date,
          status: parsed.status,
          reason: parsed.reason ?? null,
        } satisfies Database["public"]["Tables"]["attendance_requests"]["Insert"],
      ],
      { onConflict: "student_id,requested_for" },
    )
    .select()
    .single();

  if (result.error || !result.data) {
    throw new Error(
      `Failed to upsert attendance: ${result.error?.message ?? "unknown"}`,
    );
  }
}

async function storeMessage(
  supabase: any,
  guardianId: string,
  studentId: string | null,
  body: string,
) {
  const inserted = await supabase
    .from("messages")
    .insert({
      guardian_id: guardianId,
      student_id: studentId,
      direction: "inbound",
      body,
    })
    .select()
    .single();

  if (inserted.error) {
    throw new Error(
      `Failed to save message: ${inserted.error?.message ?? "unknown"}`,
    );
  }
}

async function handleMessageEvent(
  event: WebhookEvent,
  supabase: any,
  client: Client | null,
) {
  if (event.type !== "message" || event.message.type !== "text") return;
  const userId = event.source.userId;
  if (!userId) return;

  const text = event.message.text?.trim() ?? "";
  const guardian = await getOrCreateGuardian(supabase, client, userId);

  let reply = "メッセージを受け付けました。";
  let studentId: string | null = null;

  const attendance = parseAttendanceCommand(text);
  if (attendance) {
    const student = await findOrCreateStudent(
      supabase,
      guardian.id,
      attendance.studentName,
    );
    studentId = student.id;
    await upsertAttendance(supabase, guardian.id, student.id, attendance);
    reply = `出欠を登録しました: ${attendance.studentName} ${attendance.date} ${attendance.status}`;
  }

  await storeMessage(supabase, guardian.id, studentId, text);

  if (client && "replyToken" in event && event.replyToken) {
    try {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: reply,
      });
    } catch (err) {
      console.error("Failed to reply to LINE", err);
    }
  }
}

export async function POST(req: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  const bodyText = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (channelSecret && signature) {
    const valid = validateSignature(bodyText, channelSecret, signature);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }
  } else {
    console.warn(
      "LINE signature validation skipped: missing LINE_CHANNEL_SECRET or x-line-signature header",
    );
  }

  let parsedBody: { events?: WebhookEvent[] };
  try {
    parsedBody = JSON.parse(bodyText) as { events?: WebhookEvent[] };
  } catch (err) {
    console.error("Failed to parse LINE webhook body", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const events = parsedBody.events ?? [];

  const supabase = getSupabaseServerClient() as any;
  const client =
    channelAccessToken && channelSecret
      ? new Client({
          channelAccessToken,
          channelSecret,
        })
      : null;

  for (const event of events) {
    try {
      await handleMessageEvent(event, supabase, client);
    } catch (err) {
      console.error("Failed to handle LINE webhook event", err);
    }
  }

  return NextResponse.json({ ok: true });
}

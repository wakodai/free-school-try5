import {
  Client,
  validateSignature,
  type Message,
  type WebhookEvent,
} from "@line/bot-sdk";
import type { SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getOptionalEnv } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

type SupabaseClient = SupabaseClientType<Database>;
type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];
type GuardianRow = Database["public"]["Tables"]["guardians"]["Row"];
type StudentRow = Database["public"]["Tables"]["students"]["Row"];
type AttendanceRow =
  Database["public"]["Tables"]["attendance_requests"]["Row"];
type LineFlowSessionRow =
  Database["public"]["Tables"]["line_flow_sessions"]["Row"];
type LineFlowSessionInsert =
  Database["public"]["Tables"]["line_flow_sessions"]["Insert"];

type Flow = "idle" | "registration" | "attendance" | "status" | "settings";
type RegistrationStep =
  | "ask_guardian_name"
  | "ask_child_name"
  | "ask_child_grade"
  | "ask_more_children";
type AttendanceStep =
  | "choose_student"
  | "choose_date"
  | "choose_status"
  | "ask_comment";
type StatusStep = "choose_student" | "choose_range";
type SettingsStep = "ask_child_name" | "ask_child_grade" | "ask_more_children";
type SessionStep =
  | RegistrationStep
  | AttendanceStep
  | StatusStep
  | SettingsStep
  | "idle";
type RangeOption = "next3" | "month" | "custom";

type SessionData = {
  guardianId?: string;
  resumeFlow?: Flow;
  pendingChildName?: string;
  pendingChildGrade?: string;
  attendance?: {
    studentId?: string;
    requestedFor?: string;
    status?: AttendanceStatus;
  };
  statusCheck?: {
    studentId?: string;
    range?: RangeOption;
    customDate?: string;
  };
};

type Session = {
  lineUserId: string;
  flow: Flow;
  step: SessionStep;
  data: SessionData;
  guardianId?: string | null;
};

type QuickReplyAction =
  | {
      type: "postback";
      label: string;
      data: string;
      displayText?: string;
    }
  | {
      type: "datetimepicker";
      label: string;
      data: string;
      mode: "date";
      initial?: string;
      max?: string;
      min?: string;
    };

type QuickReplyItem = {
  type: "action";
  action: QuickReplyAction;
};

type ParsedPostback = {
  flow: "entry" | Flow | "unknown";
  key?: string;
  value?: string;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 48;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const defaultLessonWeekdays = [6]; // Saturday
const lessonWeekdays = parseLessonWeekdays(
  getOptionalEnv("LINE_LESSON_WEEKDAYS", "6"),
);

const gradeOptions: Array<{ label: string; value: string }> = [
  { label: "年少", value: "年少" },
  { label: "年中", value: "年中" },
  { label: "年長", value: "年長" },
  { label: "小1", value: "小1" },
  { label: "小2", value: "小2" },
  { label: "小3", value: "小3" },
  { label: "小4", value: "小4" },
  { label: "小5", value: "小5" },
  { label: "小6", value: "小6" },
  { label: "中1", value: "中1" },
  { label: "中2", value: "中2" },
  { label: "中3", value: "中3" },
  { label: "高校生", value: "高校生" },
  { label: "その他", value: "その他" },
];

const statusLabel: Record<AttendanceStatus, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  unknown: "未定",
};

function nowIso(): string {
  return new Date().toISOString();
}

function today(): string {
  return toISODate(new Date());
}

function parseLessonWeekdays(raw?: string | null): number[] {
  if (!raw) return defaultLessonWeekdays;
  const parsed = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => !Number.isNaN(value) && value >= 0 && value <= 6);
  return parsed.length ? parsed : defaultLessonWeekdays;
}

function toISODate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromISODate(date: string): Date {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateLabel(date: string): string {
  const dt = fromISODate(date);
  const day = dt.getUTCDate();
  const month = dt.getUTCMonth() + 1;
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][dt.getUTCDay()];
  return `${month}/${day}(${weekday})`;
}

function getUpcomingLessonDates(count: number, startDate?: string): string[] {
  const base = startDate ? fromISODate(startDate) : new Date();
  const results: string[] = [];
  const cursor = new Date(base.getTime());

  while (results.length < count) {
    const day = cursor.getUTCDay();
    if (lessonWeekdays.includes(day)) {
      results.push(toISODate(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (results.length === 0 && cursor.getTime() - base.getTime() > 1000 * 60 * 60 * 24 * 60) {
      break;
    }
  }

  return results;
}

function getLessonDatesWithinRange(from: string, to: string): string[] {
  const start = fromISODate(from);
  const end = fromISODate(to);
  const results: string[] = [];
  const cursor = new Date(start.getTime());

  while (cursor <= end) {
    if (lessonWeekdays.includes(cursor.getUTCDay())) {
      results.push(toISODate(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

function parsePostbackData(raw: string | undefined | null): ParsedPostback {
  if (!raw) return { flow: "unknown" };
  const [flow, key, value] = raw.split(":");
  const knownFlow: ParsedPostback["flow"] =
    flow === "entry" || flow === "registration" || flow === "attendance" || flow === "status" || flow === "settings"
      ? (flow as ParsedPostback["flow"])
      : "unknown";
  if (knownFlow !== "unknown") {
    return { flow: knownFlow, key, value };
  }

  try {
    const params = new URLSearchParams(raw);
    const action = params.get("action");
    if (action) {
      const normalized =
        action === "attendance" || action === "status" || action === "settings" ? (action as Flow) : action === "entry" ? "entry" : "unknown";
      return {
        flow: normalized,
        key: params.get("step") ?? params.get("key") ?? undefined,
        value: params.get("value") ?? undefined,
      };
    }
  } catch {
    // ignore parse errors
  }

  return { flow: "unknown" };
}

function makeQuickReply(items: QuickReplyItem[]) {
  return { items };
}

function gradeQuickReply(
  flow: "registration" | "settings" = "registration",
): Message["quickReply"] {
  const prefix = flow === "settings" ? "settings" : "registration";
  return makeQuickReply(
    gradeOptions.slice(0, 12).map((option) => ({
      type: "action",
      action: {
        type: "postback",
        label: option.label,
        data: `${prefix}:grade:${option.value}`,
        displayText: option.label,
      },
    })),
  );
}

function moreChildrenQuickReply(
  flow: "registration" | "settings",
): Message["quickReply"] {
  const prefix = flow === "settings" ? "settings" : "registration";
  return makeQuickReply([
    {
      type: "action",
      action: {
        type: "postback",
        label: "追加する",
        data: `${prefix}:more:yes`,
        displayText: "追加する",
      },
    },
    {
      type: "action",
      action: {
        type: "postback",
        label: "これで完了",
        data: `${prefix}:more:no`,
        displayText: "これで完了",
      },
    },
  ]);
}

function studentQuickReply(
  students: StudentRow[],
  flow: "attendance" | "status",
): Message["quickReply"] {
  const prefix = flow === "attendance" ? "attendance" : "status";
  const items: QuickReplyItem[] = students.slice(0, 12).map((child): QuickReplyItem => ({
    type: "action",
    action: {
      type: "postback",
      label: child.grade ? `${child.name} (${child.grade})` : child.name,
      data: `${prefix}:student:${child.id}`,
      displayText: `${child.name} を選択`,
    },
  }));

  items.push({
    type: "action",
    action: {
      type: "postback",
      label: "子どもを追加",
      data: "settings:start",
      displayText: "子どもを追加する",
    },
  });

  return makeQuickReply(items);
}

function attendanceDateQuickReply(dates: string[]): Message["quickReply"] {
  const items: QuickReplyItem[] = dates.slice(0, 4).map((date) => ({
    type: "action",
    action: {
      type: "postback",
      label: formatDateLabel(date),
      data: `attendance:date:${date}`,
      displayText: formatDateLabel(date),
    },
  }));

  items.push({
    type: "action",
    action: {
      type: "datetimepicker",
      label: "カレンダーから選ぶ",
      data: "attendance:date:picker",
      mode: "date",
      initial: today(),
      min: today(),
    },
  });

  return makeQuickReply(items);
}

function attendanceStatusQuickReply(): Message["quickReply"] {
  const statuses: AttendanceStatus[] = ["present", "absent", "late", "unknown"];
  return makeQuickReply(
    statuses.map((status) => ({
      type: "action",
      action: {
        type: "postback",
        label: statusLabel[status],
        data: `attendance:status:${status}`,
        displayText: statusLabel[status],
      },
    })),
  );
}

function attendanceCommentQuickReply(): Message["quickReply"] {
  return makeQuickReply([
    {
      type: "action",
      action: {
        type: "postback",
        label: "なし",
        data: "attendance:comment:none",
        displayText: "なし",
      },
    },
  ]);
}

function statusRangeQuickReply(): Message["quickReply"] {
  return makeQuickReply([
    {
      type: "action",
      action: {
        type: "postback",
        label: "次回〜3回",
        data: "status:range:next3",
        displayText: "次回〜3回",
      },
    },
    {
      type: "action",
      action: {
        type: "postback",
        label: "今月",
        data: "status:range:month",
        displayText: "今月",
      },
    },
    {
      type: "action",
      action: {
        type: "datetimepicker",
        label: "日付を選ぶ",
        data: "status:range:custom",
        mode: "date",
        initial: today(),
      },
    },
  ]);
}

function mainMenuQuickReply(): Message["quickReply"] {
  return makeQuickReply([
    {
      type: "action",
      action: {
        type: "postback",
        label: "出欠登録",
        data: "entry:attendance",
        displayText: "出欠登録",
      },
    },
    {
      type: "action",
      action: {
        type: "postback",
        label: "登録状況確認",
        data: "entry:status",
        displayText: "登録状況確認",
      },
    },
    {
      type: "action",
      action: {
        type: "postback",
        label: "設定",
        data: "entry:settings",
        displayText: "設定",
      },
    },
  ]);
}

async function replyMessage(
  client: Client | null,
  replyToken: string | undefined,
  messages: Message | Message[],
) {
  if (!client || !replyToken) return;
  const payload = Array.isArray(messages) ? messages : [messages];
  if (!payload.length) return;
  await client.replyMessage(replyToken, payload);
}

async function loadSession(
  supabase: SupabaseClient,
  lineUserId: string,
): Promise<Session | null> {
  const { data } = await supabase
    .from("line_flow_sessions")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  const session = (data as LineFlowSessionRow | null) ?? null;
  if (!session) return null;
  const expired =
    session.expires_at && new Date(session.expires_at).getTime() < Date.now();
  if (expired) {
    await supabase.from("line_flow_sessions").delete().eq("line_user_id", lineUserId);
    return null;
  }
  return {
    lineUserId: session.line_user_id,
    flow: (session.flow as Flow) ?? "idle",
    step: (session.step as SessionStep) ?? "idle",
    data: (session.data as SessionData) ?? {},
    guardianId: session.guardian_id,
  };
}

async function persistSession(
  supabase: SupabaseClient,
  session: Session,
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const payload: LineFlowSessionInsert = {
    line_user_id: session.lineUserId,
    guardian_id: session.guardianId ?? session.data.guardianId ?? null,
    flow: session.flow,
    step: session.step,
    data: (session.data ?? {}) as LineFlowSessionInsert["data"],
    expires_at: expiresAt,
    updated_at: nowIso(),
  };
  const lineFlowSessions = supabase.from("line_flow_sessions") as unknown as {
    upsert: (
      values: LineFlowSessionInsert,
      options?: { onConflict?: string },
    ) => Promise<unknown>;
  };
  await lineFlowSessions.upsert(payload, { onConflict: "line_user_id" });
}

async function resetSession(
  supabase: SupabaseClient,
  lineUserId: string,
  guardianId?: string | null,
) {
  await persistSession(supabase, {
    lineUserId,
    flow: "idle",
    step: "idle",
    data: guardianId ? { guardianId } : {},
    guardianId: guardianId ?? null,
  });
}

async function findGuardianByLineUserId(
  supabase: SupabaseClient,
  lineUserId: string,
): Promise<GuardianRow | null> {
  const { data } = await supabase
    .from("guardians")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  return data ?? null;
}

async function createGuardian(
  supabase: SupabaseClient,
  name: string,
  lineUserId: string,
): Promise<GuardianRow> {
  const guardiansTable = supabase.from("guardians") as unknown as {
    insert: (
      values: Database["public"]["Tables"]["guardians"]["Insert"],
    ) => {
      select: () => {
        single: () => Promise<{
          data: GuardianRow | null;
          error: { message?: string } | null;
          status?: number;
        }>;
      };
    };
  };
  const { data, error } = await guardiansTable
    .insert({ name, line_user_id: lineUserId })
    .select()
    .single();
  if (error || !data) {
    throw new Error(
      `保護者の登録に失敗しました: ${error?.message ?? "unknown"}`,
    );
  }
  return data;
}

async function upsertGuardianName(
  supabase: SupabaseClient,
  guardianId: string,
  name: string,
) {
  const guardiansTable = supabase.from("guardians") as unknown as {
    update: (
      values: Database["public"]["Tables"]["guardians"]["Update"],
    ) => {
      eq: (column: "id", value: string) => Promise<unknown>;
    };
  };
  await guardiansTable.update({ name }).eq("id", guardianId);
}

async function createStudent(
  supabase: SupabaseClient,
  guardianId: string,
  name: string,
  grade?: string | null,
): Promise<StudentRow> {
  const studentsTable = supabase.from("students") as unknown as {
    insert: (
      values: Database["public"]["Tables"]["students"]["Insert"],
    ) => {
      select: () => {
        single: () => Promise<{
          data: StudentRow | null;
          error: { message?: string } | null;
          status?: number;
        }>;
      };
    };
  };
  const { data, error, status } = await studentsTable
    .insert({
      name,
      grade: grade ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `児童登録に失敗しました: ${error?.message ?? "unknown"} (${status ?? 500})`,
    );
  }

  const guardianStudentsTable = supabase.from("guardian_students") as unknown as {
    insert: (
      values: Database["public"]["Tables"]["guardian_students"]["Insert"],
    ) => Promise<{ error: { message: string; code?: string } | null }>;
  };
  const { error: linkError } = await guardianStudentsTable.insert({
    guardian_id: guardianId,
    student_id: data.id,
  });

  if (linkError && linkError.code !== "23505") {
    throw new Error(
      `保護者との紐付けに失敗しました: ${linkError.message}`,
    );
  }

  return data;
}

async function listStudentsForGuardian(
  supabase: SupabaseClient,
  guardianId: string,
): Promise<StudentRow[]> {
  const { data, error } = await supabase
    .from("guardian_students")
    .select("student:students(*)")
    .eq("guardian_id", guardianId);
  if (error || !data) return [];
  return data
    .map((row: { student: StudentRow | null }) => row.student)
    .filter(Boolean) as StudentRow[];
}

async function upsertAttendance(
  supabase: SupabaseClient,
  input: {
    guardianId: string;
    studentId: string;
    requestedFor: string;
    status: AttendanceStatus;
    reason?: string | null;
  },
) {
  const attendanceRequestsTable = supabase.from("attendance_requests") as unknown as {
    upsert: (
      values: Database["public"]["Tables"]["attendance_requests"]["Insert"],
      options?: { onConflict?: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await attendanceRequestsTable.upsert(
    {
      guardian_id: input.guardianId,
      student_id: input.studentId,
      requested_for: input.requestedFor,
      status: input.status,
      reason: input.reason ?? null,
    },
    { onConflict: "student_id,requested_for" },
  );

  if (error) {
    throw new Error(
      `出欠登録に失敗しました: ${error.message}`,
    );
  }
}

async function storeInboundMessage(
  supabase: SupabaseClient,
  guardianId: string,
  studentId: string | null,
  body: string,
) {
  const messagesTable = supabase.from("messages") as unknown as {
    insert: (
      values: Database["public"]["Tables"]["messages"]["Insert"],
    ) => Promise<unknown>;
  };
  await messagesTable.insert({
    guardian_id: guardianId,
    student_id: studentId,
    direction: "inbound",
    body,
  });
}

async function storeOutboundMessage(
  supabase: SupabaseClient,
  guardianId: string | null,
  studentId: string | null,
  body: string,
) {
  if (!guardianId) return;
  const messagesTable = supabase.from("messages") as unknown as {
    insert: (
      values: Database["public"]["Tables"]["messages"]["Insert"],
    ) => Promise<unknown>;
  };
  await messagesTable.insert({
    guardian_id: guardianId,
    student_id: studentId,
    direction: "outbound",
    body,
  });
}

async function fetchAttendanceMap(
  supabase: SupabaseClient,
  guardianId: string,
  studentId: string,
  from: string,
  to: string,
) {
  const { data } = await supabase
    .from("attendance_requests")
    .select("*")
    .eq("guardian_id", guardianId)
    .eq("student_id", studentId)
    .gte("requested_for", from)
    .lte("requested_for", to);
  const map = new Map<string, AttendanceRow>();
  (data ?? []).forEach((row: AttendanceRow) => {
    map.set(row.requested_for, row);
  });
  return map;
}

async function startRegistrationFlow(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  lineUserId: string,
  session: Session | null,
  resumeFlow?: Flow,
) {
  const nextSession: Session = {
    lineUserId,
    flow: "registration",
    step: "ask_guardian_name",
    data: {
      ...session?.data,
      resumeFlow: resumeFlow ?? session?.data.resumeFlow,
      guardianId: session?.data.guardianId ?? session?.guardianId ?? undefined,
    },
    guardianId: session?.guardianId ?? null,
  };
  await persistSession(supabase, nextSession);
  await replyMessage(client, replyToken, {
    type: "text",
    text: "はじめに保護者名をフルネームで入力してください。",
  });
}

async function startSettingsFlow(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  guardianId: string,
  lineUserId: string,
  resumeFlow?: Flow,
) {
  const nextSession: Session = {
    lineUserId,
    flow: "settings",
    step: "ask_child_name",
    data: {
      guardianId,
      resumeFlow,
    },
    guardianId,
  };
  await persistSession(supabase, nextSession);
  await replyMessage(client, replyToken, {
    type: "text",
    text: "追加したいお子さんの名前をフルネームで入力してください。",
  });
}

async function startAttendanceFlow(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  guardian: GuardianRow,
  lineUserId: string,
) {
  const children = await listStudentsForGuardian(supabase, guardian.id);
  if (children.length === 0) {
    const session: Session = {
      lineUserId,
      flow: "settings",
      step: "ask_child_name",
      data: { guardianId: guardian.id, resumeFlow: "attendance" },
      guardianId: guardian.id,
    };
    await persistSession(supabase, session);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "まだお子さんが登録されていません。追加したいお子さんの名前を教えてください。",
    });
    return;
  }

  const session: Session = {
    lineUserId,
    flow: "attendance",
    step: "choose_student",
    data: { guardianId: guardian.id },
    guardianId: guardian.id,
  };
  await persistSession(supabase, session);

  await replyMessage(client, replyToken, {
    type: "text",
    text: "どのお子さんですか？ボタンから選んでください。",
    quickReply: studentQuickReply(children, "attendance"),
  });
}

async function startStatusFlow(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  guardian: GuardianRow,
  lineUserId: string,
) {
  const children = await listStudentsForGuardian(supabase, guardian.id);
  if (children.length === 0) {
    const session: Session = {
      lineUserId,
      flow: "settings",
      step: "ask_child_name",
      data: { guardianId: guardian.id, resumeFlow: "status" },
      guardianId: guardian.id,
    };
    await persistSession(supabase, session);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "まだお子さんが登録されていません。追加したいお子さんの名前を教えてください。",
    });
    return;
  }

  const session: Session = {
    lineUserId,
    flow: "status",
    step: "choose_student",
    data: { guardianId: guardian.id },
    guardianId: guardian.id,
  };
  await persistSession(supabase, session);

  await replyMessage(client, replyToken, {
    type: "text",
    text: "どのお子さんの状況を確認しますか？",
    quickReply: studentQuickReply(children, "status"),
  });
}

async function handleRegistrationText(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  text: string,
  lineUserId: string,
  session: Session,
  guardian: GuardianRow | null,
) {
  const current = session.step;
  if (current === "ask_guardian_name") {
    const name = text.trim();
    if (!name) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "お名前をもう一度入力してください。",
      });
      return;
    }

    const existing = guardian ?? (await findGuardianByLineUserId(supabase, lineUserId));
    const created = existing
      ? existing
      : await createGuardian(supabase, name, lineUserId);

    if (existing && existing.name !== name) {
      await upsertGuardianName(supabase, existing.id, name);
    }

    const next: Session = {
      lineUserId,
      flow: "registration",
      step: "ask_child_name",
      data: { ...session.data, guardianId: created.id },
      guardianId: created.id,
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "お子さんの名前をフルネームで入力してください。",
    });
    return;
  }

  if (current === "ask_child_name") {
    const childName = text.trim();
    if (!childName) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "お子さんの名前を入力してください。",
      });
      return;
    }

    const next: Session = {
      ...session,
      step: "ask_child_grade",
      data: { ...session.data, pendingChildName: childName },
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "学年を選んでください（例：小3〜中2）。",
      quickReply: gradeQuickReply("registration"),
    });
    return;
  }

  if (current === "ask_child_grade") {
    const grade = text.trim();
    await handleGradeSelection(
      supabase,
      client,
      replyToken,
      grade,
      lineUserId,
      session,
    );
    return;
  }

  if (current === "ask_more_children") {
    const normalized = text.trim();
    const yes = normalized === "追加する";
    const no = normalized === "これで完了";
    if (yes) {
      const next: Session = {
        ...session,
        step: "ask_child_name",
        data: { ...session.data, pendingChildName: undefined },
      };
      await persistSession(supabase, next);
      await replyMessage(client, replyToken, {
        type: "text",
        text: "次のお子さんの名前を入力してください。",
      });
      return;
    }
    if (no) {
      await finishRegistration(
        supabase,
        client,
        replyToken,
        lineUserId,
        session,
      );
      return;
    }
  }

  await replyMessage(client, replyToken, {
    type: "text",
    text: "ボタンを使って回答してください。",
  });
}

async function handleGradeSelection(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  grade: string,
  lineUserId: string,
  session: Session,
) {
  const childName = session.data.pendingChildName;
  const guardianId = session.data.guardianId ?? session.guardianId;
  if (!childName || !guardianId) {
    await resetSession(supabase, lineUserId, guardianId ?? null);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "最初からやり直してください。",
    });
    return;
  }

  const student = await createStudent(
    supabase,
    guardianId,
    childName,
    grade || null,
  );

  const next: Session = {
    ...session,
    step: "ask_more_children",
    data: {
      ...session.data,
      pendingChildName: undefined,
      pendingChildGrade: undefined,
    },
  };
  await persistSession(supabase, next);
  await replyMessage(client, replyToken, [
    {
      type: "text",
      text: `登録しました：${student.name}${student.grade ? ` / ${student.grade}` : ""}`,
    },
    {
      type: "text",
      text: "ご兄弟を登録しますか？",
      quickReply: moreChildrenQuickReply(
        session.flow === "settings" ? "settings" : "registration",
      ),
    },
  ]);
}

async function finishRegistration(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  lineUserId: string,
  session: Session,
) {
  const guardianId = session.data.guardianId ?? session.guardianId ?? null;
  await resetSession(supabase, lineUserId, guardianId);

  const resume = session.data.resumeFlow;
  const followUp: Message[] = [
    {
      type: "text",
      text: "登録ありがとうございます。次回以降はリッチメニューから出欠登録や状況確認ができます。",
      quickReply: mainMenuQuickReply(),
    },
  ];

  await replyMessage(client, replyToken, followUp);

  if (resume && guardianId) {
    const guardian = await supabase
      .from("guardians")
      .select("*")
      .eq("id", guardianId)
      .maybeSingle()
      .then((res: { data: GuardianRow | null }) => res.data);
    if (guardian) {
      if (resume === "attendance") {
        await startAttendanceFlow(
          supabase,
          client,
          replyToken,
          guardian,
          lineUserId,
        );
      } else if (resume === "status") {
        await startStatusFlow(
          supabase,
          client,
          replyToken,
          guardian,
          lineUserId,
        );
      }
    }
  }
}

async function handleSettingsPostback(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  postback: ParsedPostback,
  session: Session,
  lineUserId: string,
) {
  if (session.step === "ask_child_grade" && postback.key === "grade" && postback.value) {
    await handleGradeSelection(
      supabase,
      client,
      replyToken,
      postback.value,
      lineUserId,
      session,
    );
    return;
  }
  if (session.step === "ask_more_children" && postback.key === "more") {
    if (postback.value === "yes") {
      const next: Session = {
        ...session,
        step: "ask_child_name",
        data: { ...session.data, pendingChildName: undefined },
      };
      await persistSession(supabase, next);
      await replyMessage(client, replyToken, {
        type: "text",
        text: "次のお子さんの名前を入力してください。",
      });
      return;
    }
    if (postback.value === "no") {
      await finishSettingsFlow(
        supabase,
        client,
        replyToken,
        lineUserId,
        session,
      );
      return;
    }
  }
}

async function finishSettingsFlow(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  lineUserId: string,
  session: Session,
) {
  const guardianId = session.data.guardianId ?? session.guardianId ?? null;
  await resetSession(supabase, lineUserId, guardianId);
  await replyMessage(client, replyToken, {
    type: "text",
    text: "設定を保存しました。続けて出欠登録や状況確認ができます。",
    quickReply: mainMenuQuickReply(),
  });

  if (session.data.resumeFlow && guardianId) {
    const guardian = await supabase
      .from("guardians")
      .select("*")
      .eq("id", guardianId)
      .maybeSingle()
      .then((res: { data: GuardianRow | null }) => res.data);
    if (guardian) {
      if (session.data.resumeFlow === "attendance") {
        await startAttendanceFlow(
          supabase,
          client,
          replyToken,
          guardian,
          lineUserId,
        );
      } else if (session.data.resumeFlow === "status") {
        await startStatusFlow(
          supabase,
          client,
          replyToken,
          guardian,
          lineUserId,
        );
      }
    }
  }
}

async function handleSettingsText(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  text: string,
  lineUserId: string,
  session: Session,
) {
  if (session.step === "ask_child_name") {
    const childName = text.trim();
    if (!childName) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "お子さんの名前を入力してください。",
      });
      return;
    }

    const next: Session = {
      ...session,
      step: "ask_child_grade",
      data: { ...session.data, pendingChildName: childName },
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "学年を選んでください。",
      quickReply: gradeQuickReply("settings"),
    });
    return;
  }

  if (session.step === "ask_child_grade") {
    await handleGradeSelection(
      supabase,
      client,
      replyToken,
      text.trim(),
      lineUserId,
      session,
    );
    return;
  }

  if (session.step === "ask_more_children") {
    const yes = text.trim() === "追加する";
    const no = text.trim() === "これで完了";
    if (yes) {
      const next: Session = {
        ...session,
        step: "ask_child_name",
        data: { ...session.data, pendingChildName: undefined },
      };
      await persistSession(supabase, next);
      await replyMessage(client, replyToken, {
        type: "text",
        text: "次のお子さんの名前を入力してください。",
      });
      return;
    }
    if (no) {
      await finishSettingsFlow(
        supabase,
        client,
        replyToken,
        lineUserId,
        session,
      );
      return;
    }
  }

  await replyMessage(client, replyToken, {
    type: "text",
    text: "ボタンから選択してください。",
  });
}

async function handleAttendancePostback(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  postback: ParsedPostback,
  session: Session,
  guardian: GuardianRow,
  lineUserId: string,
  event: WebhookEvent,
) {
  if (session.step === "choose_student" && postback.key === "student" && postback.value) {
    const next: Session = {
      ...session,
      step: "choose_date",
      data: {
        ...session.data,
        attendance: { studentId: postback.value },
      },
    };
    await persistSession(supabase, next);
    const dates = getUpcomingLessonDates(3);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "日付を選んでください。直近の授業日ボタンかカレンダーが使えます。",
      quickReply: attendanceDateQuickReply(dates),
    });
    return;
  }

  if (session.step === "choose_date" && postback.key === "date") {
    const paramsDate =
      event.type === "postback"
        ? ((event.postback.params as { date?: string } | undefined)?.date ?? undefined)
        : undefined;
    const dateFromData =
      postback.value && datePattern.test(postback.value)
        ? postback.value
        : undefined;
    const studentId = session.data.attendance?.studentId;
    const dateToUse = paramsDate ?? dateFromData;

    if (!studentId) {
      await resetSession(supabase, lineUserId, guardian.id);
      await replyMessage(client, replyToken, {
        type: "text",
        text: "もう一度お子さんを選択してください。",
        quickReply: studentQuickReply(
          await listStudentsForGuardian(supabase, guardian.id),
          "attendance",
        ),
      });
      return;
    }

    if (!dateToUse) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "日付の取得に失敗しました。もう一度選んでください。",
        quickReply: attendanceDateQuickReply(getUpcomingLessonDates(3)),
      });
      return;
    }

    const next: Session = {
      ...session,
      step: "choose_status",
      data: {
        ...session.data,
        attendance: {
          ...(session.data.attendance ?? {}),
          studentId,
          requestedFor: dateToUse,
        },
      },
    };
    await persistSession(supabase, next);

    await replyMessage(client, replyToken, {
      type: "text",
      text: "出欠を選んでください。",
      quickReply: attendanceStatusQuickReply(),
    });
    return;
  }

  if (session.step === "choose_status" && postback.key === "status" && postback.value) {
    const status = postback.value as AttendanceStatus;
    if (!["present", "absent", "late", "unknown"].includes(status)) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "出欠はボタンから選んでください。",
      });
      return;
    }
    const next: Session = {
      ...session,
      step: "ask_comment",
      data: {
        ...session.data,
        attendance: {
          ...(session.data.attendance ?? {}),
          status,
        },
      },
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "連絡があれば入力してください（なければ“なし”）。",
      quickReply: attendanceCommentQuickReply(),
    });
    return;
  }

  if (session.step === "ask_comment" && postback.key === "comment") {
    await finalizeAttendance(
      supabase,
      client,
      replyToken,
      session,
      guardian,
      postback.value === "none" ? "" : postback.value ?? "",
      lineUserId,
      true,
    );
    return;
  }
}

async function finalizeAttendance(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  session: Session,
  guardian: GuardianRow,
  comment: string,
  lineUserId: string,
  logComment: boolean,
) {
  const attendance = session.data.attendance;
  if (!attendance?.studentId || !attendance.requestedFor || !attendance.status) {
    await resetSession(supabase, lineUserId, guardian.id);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "入力が途中でリセットされました。もう一度お試しください。",
    });
    return;
  }

  await upsertAttendance(supabase, {
    guardianId: guardian.id,
    studentId: attendance.studentId,
    requestedFor: attendance.requestedFor,
    status: attendance.status,
    reason: comment ? comment : null,
  });

  const studentsTable = supabase.from("students") as unknown as {
    select: (columns: string) => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => Promise<{
          data: Pick<StudentRow, "name" | "grade"> | null;
        }>;
      };
    };
  };
  const { data: student } = await studentsTable
    .select("name, grade")
    .eq("id", attendance.studentId)
    .maybeSingle();
  const studentLabel = student
    ? `${student.name}${student.grade ? ` / ${student.grade}` : ""}`
    : "児童";

  if (logComment) {
    await storeInboundMessage(
      supabase,
      guardian.id,
      attendance.studentId,
      comment ||
        `${formatDateLabel(attendance.requestedFor)} ${statusLabel[attendance.status]}`,
    );
  }

  await storeOutboundMessage(
    supabase,
    guardian.id,
    attendance.studentId,
    `出欠を登録: ${studentLabel} ${formatDateLabel(attendance.requestedFor)} ${statusLabel[attendance.status]}${comment ? ` / ${comment}` : ""}`,
  );

  await resetSession(supabase, lineUserId, guardian.id);

  await replyMessage(client, replyToken, {
    type: "text",
    text: `登録しました。\n児童: ${studentLabel}\n日付: ${attendance.requestedFor}\n出欠: ${statusLabel[attendance.status]}${comment ? `\nメモ: ${comment}` : ""}`,
    quickReply: mainMenuQuickReply(),
  });
}

async function handleAttendanceText(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  text: string,
  session: Session,
  guardian: GuardianRow,
  lineUserId: string,
) {
  const trimmed = text.trim();

  if (session.step === "choose_student") {
    const children = await listStudentsForGuardian(supabase, guardian.id);
    const matched = children.find((child) => child.name === trimmed);
    if (!matched) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "ボタンからお子さんを選択してください。",
        quickReply: studentQuickReply(children, "attendance"),
      });
      return;
    }
    const next: Session = {
      ...session,
      step: "choose_date",
      data: { ...session.data, attendance: { studentId: matched.id } },
    };
    await persistSession(supabase, next);
    const dates = getUpcomingLessonDates(3);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "日付を選んでください。",
      quickReply: attendanceDateQuickReply(dates),
    });
    return;
  }

  if (session.step === "choose_date") {
    if (!datePattern.test(trimmed)) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "日付はYYYY-MM-DD形式で入力するか、ボタンを使ってください。",
      });
      return;
    }
    const next: Session = {
      ...session,
      step: "choose_status",
      data: {
        ...session.data,
        attendance: {
          ...(session.data.attendance ?? {}),
          requestedFor: trimmed,
        },
      },
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "出欠を選んでください。",
      quickReply: attendanceStatusQuickReply(),
    });
    return;
  }

  if (session.step === "choose_status") {
    const status = Object.entries(statusLabel).find(
      ([, label]) => label === trimmed,
    )?.[0] as AttendanceStatus | undefined;
    if (!status) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "ボタンから出欠を選択してください。",
      });
      return;
    }
    const next: Session = {
      ...session,
      step: "ask_comment",
      data: {
        ...session.data,
        attendance: {
          ...(session.data.attendance ?? {}),
          status,
        },
      },
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "連絡があれば入力してください（なければ“なし”）。",
      quickReply: attendanceCommentQuickReply(),
    });
    return;
  }

  if (session.step === "ask_comment") {
    await finalizeAttendance(
      supabase,
      client,
      replyToken,
      session,
      guardian,
      trimmed === "なし" ? "" : trimmed,
      lineUserId,
      false,
    );
    return;
  }
}

async function handleStatusPostback(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  postback: ParsedPostback,
  session: Session,
  guardian: GuardianRow,
  lineUserId: string,
  event: WebhookEvent,
) {
  if (session.step === "choose_student" && postback.key === "student" && postback.value) {
    const next: Session = {
      ...session,
      step: "choose_range",
      data: {
        ...session.data,
        statusCheck: { studentId: postback.value },
      },
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "どの範囲を見ますか？",
      quickReply: statusRangeQuickReply(),
    });
    return;
  }

  if (session.step === "choose_range" && postback.key === "range") {
    const paramsDate =
      event.type === "postback"
        ? ((event.postback.params as { date?: string } | undefined)?.date ?? undefined)
        : undefined;
    let dates: string[] = [];
    if (postback.value === "next3") {
      dates = getUpcomingLessonDates(3);
    } else if (postback.value === "month") {
      const base = today();
      const dt = fromISODate(base);
      const from = `${dt.getUTCFullYear()}-${`${dt.getUTCMonth() + 1}`.padStart(2, "0")}-01`;
      const endDate = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
      const to = toISODate(endDate);
      dates = getLessonDatesWithinRange(from, to);
    } else if (postback.value && datePattern.test(postback.value)) {
      dates = [postback.value];
    } else if (paramsDate && datePattern.test(paramsDate)) {
      dates = [paramsDate];
    }

    if (!dates.length) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "日付の取得に失敗しました。もう一度選んでください。",
        quickReply: statusRangeQuickReply(),
      });
      return;
    }

    await sendStatusSummary(
      supabase,
      client,
      replyToken,
      guardian,
      session,
      dates,
      lineUserId,
    );
  }
}

async function handleStatusText(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  text: string,
  session: Session,
  guardian: GuardianRow,
  lineUserId: string,
) {
  const trimmed = text.trim();
  if (session.step === "choose_student") {
    const children = await listStudentsForGuardian(supabase, guardian.id);
    const matched = children.find((child) => child.name === trimmed);
    if (!matched) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "ボタンからお子さんを選択してください。",
        quickReply: studentQuickReply(children, "status"),
      });
      return;
    }
    const next: Session = {
      ...session,
      step: "choose_range",
      data: { ...session.data, statusCheck: { studentId: matched.id } },
    };
    await persistSession(supabase, next);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "どの範囲を見ますか？",
      quickReply: statusRangeQuickReply(),
    });
    return;
  }

  if (session.step === "choose_range") {
    if (!datePattern.test(trimmed)) {
      await replyMessage(client, replyToken, {
        type: "text",
        text: "ボタンで範囲を選ぶか、YYYY-MM-DDで日付を入力してください。",
      });
      return;
    }
    await sendStatusSummary(
      supabase,
      client,
      replyToken,
      guardian,
      session,
      [trimmed],
      lineUserId,
    );
  }
}

async function sendStatusSummary(
  supabase: SupabaseClient,
  client: Client | null,
  replyToken: string | undefined,
  guardian: GuardianRow,
  session: Session,
  dates: string[],
  lineUserId: string,
) {
  const statusCheck = session.data.statusCheck;
  const studentId = statusCheck?.studentId;
  if (!studentId) {
    await resetSession(supabase, lineUserId, guardian.id);
    await replyMessage(client, replyToken, {
      type: "text",
      text: "もう一度お子さんを選択してください。",
      quickReply: studentQuickReply(
        await listStudentsForGuardian(supabase, guardian.id),
        "status",
      ),
    });
    return;
  }

  const sortedDates = [...dates].sort();
  const from = sortedDates[0];
  const to = sortedDates[sortedDates.length - 1];
  const attendanceMap = await fetchAttendanceMap(
    supabase,
    guardian.id,
    studentId,
    from,
    to,
  );

  const lines = sortedDates.map((date) => {
    const row = attendanceMap.get(date);
    if (!row) return `- ${formatDateLabel(date)} 未回答`;
    return `- ${formatDateLabel(date)} ${statusLabel[row.status]}${
      row.reason ? `（${row.reason}）` : ""
    }`;
  });

  await resetSession(supabase, lineUserId, guardian.id);

  await replyMessage(client, replyToken, {
    type: "text",
    text:
      lines.length > 0
        ? `登録状況:\n${lines.join("\n")}`
        : "まだ出欠の登録がありません。",
    quickReply: mainMenuQuickReply(),
  });
}

async function routePostback(
  supabase: SupabaseClient,
  client: Client | null,
  event: WebhookEvent,
  guardian: GuardianRow | null,
  session: Session | null,
) {
  if (event.type !== "postback") return;
  const parsed = parsePostbackData(event.postback.data);
  const lineUserId = event.source.userId!;
  const currentSession: Session | null =
    session ??
    (guardian
      ? {
          lineUserId,
          flow: "idle",
          step: "idle",
          data: { guardianId: guardian.id },
          guardianId: guardian.id,
        }
      : null);

  if (parsed.flow === "entry") {
    if (!guardian) {
      await startRegistrationFlow(
        supabase,
        client,
        event.replyToken,
        lineUserId,
        currentSession,
        parsed.key === "status" ? "status" : parsed.key === "attendance" ? "attendance" : undefined,
      );
      return;
    }
    if (parsed.key === "attendance") {
      await startAttendanceFlow(
        supabase,
        client,
        event.replyToken,
        guardian,
        lineUserId,
      );
      return;
    }
    if (parsed.key === "status") {
      await startStatusFlow(
        supabase,
        client,
        event.replyToken,
        guardian,
        lineUserId,
      );
      return;
    }
    if (parsed.key === "settings") {
      await startSettingsFlow(
        supabase,
        client,
        event.replyToken,
        guardian.id,
        lineUserId,
      );
      return;
    }
  }

  if (!guardian) {
    await startRegistrationFlow(
      supabase,
      client,
      event.replyToken,
      lineUserId,
      currentSession,
    );
    return;
  }

  if (!currentSession) {
    return;
  }

  if (parsed.flow === "registration") {
    await handleRegistrationText(
      supabase,
      client,
      event.replyToken,
      parsed.value ?? "",
      lineUserId,
      currentSession,
      guardian,
    );
    return;
  }

  if (parsed.flow === "settings") {
    if (parsed.key === "start" && guardian) {
      const resumeFlow =
        currentSession?.flow === "attendance"
          ? "attendance"
          : currentSession?.flow === "status"
            ? "status"
            : undefined;
      await startSettingsFlow(
        supabase,
        client,
        event.replyToken,
        guardian.id,
        lineUserId,
        resumeFlow,
      );
      return;
    }
    await handleSettingsPostback(
      supabase,
      client,
      event.replyToken,
      parsed,
      currentSession,
      lineUserId,
    );
    return;
  }

  if (parsed.flow === "attendance" && guardian) {
    await handleAttendancePostback(
      supabase,
      client,
      event.replyToken,
      parsed,
      currentSession,
      guardian,
      lineUserId,
      event,
    );
    return;
  }

  if (parsed.flow === "status" && guardian) {
    await handleStatusPostback(
      supabase,
      client,
      event.replyToken,
      parsed,
      currentSession,
      guardian,
      lineUserId,
      event,
    );
    return;
  }
}

async function routeMessage(
  supabase: SupabaseClient,
  client: Client | null,
  event: WebhookEvent,
  guardian: GuardianRow | null,
  session: Session | null,
) {
  if (event.type !== "message" || event.message.type !== "text") return;
  const text = event.message.text ?? "";
  const lineUserId = event.source.userId!;

  if (guardian) {
    await storeInboundMessage(supabase, guardian.id, null, text);
  }

  if (!guardian) {
    await startRegistrationFlow(
      supabase,
      client,
      event.replyToken,
      lineUserId,
      session,
    );
    return;
  }

  if (!session || session.flow === "idle") {
    await replyMessage(client, event.replyToken, {
      type: "text",
      text: "リッチメニューから操作を選んでください。（出欠登録/登録状況確認/設定）",
      quickReply: mainMenuQuickReply(),
    });
    return;
  }

  if (session.flow === "registration") {
    await handleRegistrationText(
      supabase,
      client,
      event.replyToken,
      text,
      lineUserId,
      session,
      guardian,
    );
    return;
  }

  if (session.flow === "settings") {
    await handleSettingsText(
      supabase,
      client,
      event.replyToken,
      text,
      lineUserId,
      session,
    );
    return;
  }

  if (session.flow === "attendance") {
    await handleAttendanceText(
      supabase,
      client,
      event.replyToken,
      text,
      session,
      guardian,
      lineUserId,
    );
    return;
  }

  if (session.flow === "status") {
    await handleStatusText(
      supabase,
      client,
      event.replyToken,
      text,
      session,
      guardian,
      lineUserId,
    );
  }
}

async function handleFollowEvent(
  supabase: SupabaseClient,
  client: Client | null,
  event: WebhookEvent,
  guardian: GuardianRow | null,
  session: Session | null,
) {
  if (event.type !== "follow") return;
  const lineUserId = event.source.userId!;
  if (!guardian) {
    await startRegistrationFlow(
      supabase,
      client,
      event.replyToken,
      lineUserId,
      session,
    );
    return;
  }

  await resetSession(supabase, lineUserId, guardian.id);
  await replyMessage(client, event.replyToken, {
    type: "text",
    text: "いつでもリッチメニューから出欠登録できます。",
    quickReply: mainMenuQuickReply(),
  });
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
  }

  let parsedBody: { events?: WebhookEvent[] };
  try {
    parsedBody = JSON.parse(bodyText) as { events?: WebhookEvent[] };
  } catch (err) {
    console.error("Failed to parse LINE webhook body", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const events = parsedBody.events ?? [];

  const supabase = getSupabaseServerClient();
  const client =
    channelAccessToken && channelSecret
      ? new Client({
          channelAccessToken,
          channelSecret,
        })
      : null;

  for (const event of events) {
    const userId = event.source.userId;
    if (!userId) continue;
    try {
      const guardian = await findGuardianByLineUserId(supabase, userId);
      const session = await loadSession(supabase, userId);

      await handleFollowEvent(supabase, client, event, guardian, session);
      await routePostback(supabase, client, event, guardian, session);
      await routeMessage(supabase, client, event, guardian, session);
    } catch (err) {
      console.error("Failed to handle LINE webhook event", err);
    }
  }

  return NextResponse.json({ ok: true });
}

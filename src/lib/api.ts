import {
  type AttendanceQuery,
  type CreateAttendanceInput,
  type CreateGuardianInput,
  type CreateMessageInput,
  type CreateStudentInput,
  type MessagesQuery,
  type StatsQuery,
} from "./validators";
import type {
  AttendanceRequest,
  AttendanceStats,
  Guardian,
  Message,
  Student,
} from "@/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      "サーバーに接続できませんでした。ネットワーク接続を確認してください。",
      0,
      url,
    );
  }

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      (typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as Record<string, string>).error
        : undefined) ??
      (typeof payload === "object" && payload !== null && "message" in payload
        ? (payload as Record<string, string>).message
        : undefined) ??
      `リクエストに失敗しました (${response.status})`;
    throw new ApiError(message, response.status, url);
  }

  return payload as T;
}

export function createGuardian(input: CreateGuardianInput) {
  return apiFetch<Guardian>("/api/guardians", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listGuardians() {
  return apiFetch<Guardian[]>("/api/guardians");
}

export function createStudent(input: CreateStudentInput) {
  return apiFetch<Student>("/api/students", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listStudents(opts?: {
  guardianId?: string;
  withGuardian?: boolean;
}) {
  const params = new URLSearchParams();
  if (opts?.guardianId) params.set("guardianId", opts.guardianId);
  if (opts?.withGuardian) params.set("withGuardian", "true");
  const qs = params.toString();
  return apiFetch<Student[]>(`/api/students${qs ? `?${qs}` : ""}`);
}

export function deleteStudent(id: string) {
  return apiFetch<{ success: boolean }>(`/api/students/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function submitAttendance(input: CreateAttendanceInput) {
  return apiFetch<AttendanceRequest>("/api/attendance", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchAttendance(query: AttendanceQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return apiFetch<AttendanceRequest[]>(`/api/attendance${qs ? `?${qs}` : ""}`);
}

export function fetchStats(query: StatsQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return apiFetch<AttendanceStats>(
    `/api/attendance/stats${qs ? `?${qs}` : ""}`,
  );
}

export function postMessage(input: CreateMessageInput) {
  return apiFetch<Message>("/api/messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchMessages(query: MessagesQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return apiFetch<Message[]>(`/api/messages${qs ? `?${qs}` : ""}`);
}

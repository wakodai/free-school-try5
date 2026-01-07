"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createGuardian,
  createStudent,
  fetchMessages,
  listGuardians,
  listStudents,
  postMessage,
  submitAttendance,
} from "@/lib/api";
import type {
  AttendanceStatus,
  Guardian,
  Message,
  MessageDirection,
  Student,
} from "@/types";

type Toast = { type: "success" | "error"; message: string } | null;

const statusLabels: Record<AttendanceStatus, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  unknown: "未定",
};

const statusTone: Record<AttendanceStatus, string> = {
  present: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  absent: "bg-rose-50 text-rose-700 border border-rose-100",
  late: "bg-amber-50 text-amber-700 border border-amber-100",
  unknown: "bg-slate-100 text-slate-700 border border-slate-200",
};

const directionLabels: Record<MessageDirection, string> = {
  inbound: "保護者 → 公式アカウント",
  outbound: "公式アカウント → 保護者",
};

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === "inbound";
  return (
    <div className={`flex ${isInbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
          isInbound
            ? "bg-[#9be885] text-slate-900"
            : "bg-white text-slate-800 border border-slate-200"
        }`}
      >
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{directionLabels[message.direction]}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap leading-relaxed">
          {message.body}
        </p>
      </div>
    </div>
  );
}

export default function LineAppMock() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [guardianProfile, setGuardianProfile] = useState<Guardian | null>(null);
  const [guardianForm, setGuardianForm] = useState({ name: "", phone: "" });
  const [students, setStudents] = useState<Student[]>([]);
  const [studentForm, setStudentForm] = useState({
    name: "",
    grade: "",
    notes: "",
  });
  const [attendanceForm, setAttendanceForm] = useState<{
    studentId: string;
    requestedFor: string;
    status: AttendanceStatus;
    reason: string;
  }>({
    studentId: "",
    requestedFor: today(),
    status: "present",
    reason: "",
  });
  const [messageBody, setMessageBody] = useState("");
  const [messageStudentId, setMessageStudentId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [direction, setDirection] = useState<MessageDirection>("inbound");
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const profileRef = useRef<HTMLDivElement | null>(null);
  const studentRef = useRef<HTMLDivElement | null>(null);
  const attendanceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" &&
      localStorage.getItem("guardianProfile");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Guardian;
        setGuardianProfile(parsed);
      } catch {
        // ignore corrupted storage
      }
    }
  }, []);

  useEffect(() => {
    loadGuardians();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedGuardianId) return;
    loadStudents(selectedGuardianId);
    loadMessages(selectedGuardianId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGuardianId]);

  useEffect(() => {
    if (!guardians.length || selectedGuardianId) return;
    if (guardianProfile) {
      const matched = guardians.find((g) => g.id === guardianProfile.id);
      if (matched) {
        setSelectedGuardianId(matched.id);
        return;
      }
    }
    setSelectedGuardianId(guardians[0].id);
  }, [guardians, guardianProfile, selectedGuardianId]);

  const activeGuardian = guardians.find((g) => g.id === selectedGuardianId);
  const isProfileActive = guardianProfile?.id === activeGuardian?.id;

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
  }, [messages]);

  const loadGuardians = async () => {
    try {
      const data = await listGuardians();
      setGuardians(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudents = async (guardianId: string) => {
    try {
      const data = await listStudents(guardianId);
      setStudents(data);
      if (!attendanceForm.studentId && data.length > 0) {
        setAttendanceForm((prev) => ({ ...prev, studentId: data[0].id }));
        setMessageStudentId((prev) => prev || data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (guardianId: string) => {
    try {
      const data = await fetchMessages({ guardianId });
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGuardian = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!guardianForm.name.trim()) return;
    setLoading(true);
    setToast(null);
    try {
      const created = await createGuardian({
        name: guardianForm.name.trim(),
        phone: guardianForm.phone.trim() || undefined,
      });
      setGuardians((prev) => [created, ...prev]);
      setSelectedGuardianId(created.id);
      setGuardianForm({ name: "", phone: "" });
      if (!guardianProfile) {
        setGuardianProfile(created);
        if (typeof window !== "undefined") {
          localStorage.setItem("guardianProfile", JSON.stringify(created));
        }
      }
      setToast({ type: "success", message: "保護者を追加しました。" });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeGuardian || !studentForm.name.trim()) return;
    setLoading(true);
    setToast(null);
    try {
      const created = await createStudent({
        name: studentForm.name.trim(),
        grade: studentForm.grade.trim() || undefined,
        notes: studentForm.notes.trim() || undefined,
        guardianId: activeGuardian.id,
      });
      setStudents((prev) => [created, ...prev]);
      setStudentForm({ name: "", grade: "", notes: "" });
      if (!attendanceForm.studentId) {
        setAttendanceForm((prev) => ({ ...prev, studentId: created.id }));
        setMessageStudentId(created.id);
      }
      setToast({ type: "success", message: "児童を追加しました。" });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeGuardian || !attendanceForm.studentId) return;
    setLoading(true);
    setToast(null);
    try {
      await submitAttendance({
        guardianId: activeGuardian.id,
        studentId: attendanceForm.studentId,
        requestedFor: attendanceForm.requestedFor,
        status: attendanceForm.status,
        reason: attendanceForm.reason.trim() || undefined,
      });
      setToast({ type: "success", message: "出欠連絡を送信しました。" });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleMessageSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeGuardian || !messageBody.trim()) return;
    setLoading(true);
    setToast(null);
    try {
      const created = await postMessage({
        guardianId: activeGuardian.id,
        studentId: messageStudentId || undefined,
        direction,
        body: messageBody.trim(),
      });
      setMessages((prev) => [...prev, created]);
      setMessageBody("");
      setToast({ type: "success", message: "メッセージを送信しました。" });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = () => {
    if (!activeGuardian) return;
    setGuardianProfile(activeGuardian);
    if (typeof window !== "undefined") {
      localStorage.setItem("guardianProfile", JSON.stringify(activeGuardian));
    }
  };

  const clearProfile = () => {
    setGuardianProfile(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("guardianProfile");
    }
  };

  const refreshCurrent = async () => {
    if (!activeGuardian) return;
    setRefreshing(true);
    await Promise.all([
      loadMessages(activeGuardian.id),
      loadStudents(activeGuardian.id),
    ]);
    setRefreshing(false);
  };

  const canSendAttendance = Boolean(activeGuardian && students.length > 0);

  return (
    <div className="min-h-screen bg-[#edf0f2]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="overflow-hidden rounded-[32px] bg-white shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-emerald-100 bg-[#06c755] px-6 py-4 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/80">
                LINE Official Account Mock
              </p>
              <h1 className="text-2xl font-semibold">出欠連絡 × LINE 体験</h1>
              <p className="text-sm text-white/80">
                LIFFフォームとトークをひとつの画面に統合しました。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link
                href="/"
                className="rounded-full border border-white/60 bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
              >
                ホーム
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-white px-4 py-2 font-semibold text-[#06c755] shadow-sm transition hover:-translate-y-0.5"
              >
                ダッシュボード
              </Link>
            </div>
          </div>

          {toast ? (
            <div
              className={`mx-6 mt-4 rounded-2xl border px-4 py-3 text-sm ${
                toast.type === "success"
                  ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                  : "border-rose-100 bg-rose-50 text-rose-800"
              }`}
            >
              {toast.message}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
            <aside className="rounded-3xl border border-slate-200 bg-[#f7f9fb] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">トーク一覧</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                  {guardians.length}件
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {guardians.length === 0 ? (
                  <p className="text-xs text-slate-500">まだ登録がありません。</p>
                ) : (
                  guardians.map((guardian) => (
                    <button
                      key={guardian.id}
                      type="button"
                      onClick={() => setSelectedGuardianId(guardian.id)}
                      className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition ${
                        guardian.id === selectedGuardianId
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:bg-white/70"
                      }`}
                    >
                      <p className="font-medium">{guardian.name}</p>
                      <p className="text-xs text-slate-400">
                        {guardian.phone || "電話番号未登録"}
                      </p>
                    </button>
                  ))
                )}
              </div>
              <form onSubmit={handleCreateGuardian} className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600">新しい保護者</p>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="山田 花子"
                  value={guardianForm.name}
                  onChange={(e) =>
                    setGuardianForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="090-xxxx-xxxx (任意)"
                  value={guardianForm.phone}
                  onChange={(e) =>
                    setGuardianForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
                <button
                  disabled={loading}
                  className="w-full rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading ? "追加中..." : "追加"}
                </button>
              </form>
            </aside>

            <section className="flex flex-col rounded-3xl border border-slate-200 bg-[#eef1f4]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    LINE公式アカウント
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {activeGuardian
                      ? `${activeGuardian.name}さんとのトーク`
                      : "トークを選択してください"}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      profileRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    LIFFフォーム
                  </button>
                  <button
                    type="button"
                    onClick={refreshCurrent}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    更新
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {sortedMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-sm text-slate-500">
                    <p>まだメッセージがありません。</p>
                    <p className="text-xs">下の入力欄から送信できます。</p>
                  </div>
                ) : (
                  sortedMessages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                )}
              </div>

              <div className="border-t border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection("inbound")}
                      className={`rounded-full px-3 py-1 font-semibold transition ${
                        direction === "inbound"
                          ? "bg-[#06c755] text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                    >
                      保護者
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("outbound")}
                      className={`rounded-full px-3 py-1 font-semibold transition ${
                        direction === "outbound"
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 text-slate-600"
                      }`}
                    >
                      スタッフ
                    </button>
                  </div>
                  {activeGuardian ? (
                    <span>
                      送信先: {activeGuardian.name}
                      {messageStudentId
                        ? `（${
                            students.find((child) => child.id === messageStudentId)
                              ?.name || "児童指定"
                          }）`
                        : ""}
                    </span>
                  ) : (
                    <span>保護者を選択してください</span>
                  )}
                </div>
                <form onSubmit={handleMessageSubmit} className="mt-3 flex gap-3">
                  <textarea
                    required
                    className="min-h-[54px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                    placeholder="メッセージを入力"
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                  />
                  <button
                    disabled={loading || !activeGuardian}
                    className="h-[54px] rounded-2xl bg-[#06c755] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#05b44c] disabled:cursor-not-allowed disabled:bg-emerald-200"
                  >
                    {loading ? "送信中" : "送信"}
                  </button>
                </form>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() =>
                      studentRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    className="rounded-full border border-slate-200 bg-white px-3 py-1"
                  >
                    児童登録を開く
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      attendanceRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    className="rounded-full border border-slate-200 bg-white px-3 py-1"
                  >
                    出欠フォームを開く
                  </button>
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div
                ref={profileRef}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      LIFF プロフィール
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      保護者プロフィール
                    </h3>
                  </div>
                  {guardianProfile ? (
                    <button
                      type="button"
                      onClick={clearProfile}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      保存を解除
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  LIFFでログインした保護者を想定し、このトークを紐付けられます。
                </p>
                {activeGuardian ? (
                  <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <p className="font-semibold text-slate-800">
                      {activeGuardian.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      電話: {activeGuardian.phone || "未登録"}
                    </p>
                    <button
                      type="button"
                      onClick={saveProfile}
                      className={`w-full rounded-full px-3 py-2 text-xs font-semibold transition ${
                        isProfileActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-900 text-white"
                      }`}
                    >
                      {isProfileActive
                        ? "このトークを保存済み"
                        : "この保護者をLIFFとして保存"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    左のトーク一覧から保護者を選択してください。
                  </p>
                )}
              </div>

              <div
                ref={studentRef}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    LIFF メニュー
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">児童登録</h3>
                  <p className="text-sm text-slate-500">
                    兄弟の情報を登録して、出欠連絡を簡単に。
                  </p>
                </div>
                <form
                  onSubmit={handleCreateStudent}
                  className="mt-4 space-y-3"
                >
                  <input
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="児童名"
                    value={studentForm.name}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    disabled={!activeGuardian}
                  />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="学年 (任意)"
                    value={studentForm.grade}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, grade: e.target.value }))
                    }
                    disabled={!activeGuardian}
                  />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="メモ (任意)"
                    value={studentForm.notes}
                    onChange={(e) =>
                      setStudentForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    disabled={!activeGuardian}
                  />
                  <button
                    disabled={loading || !activeGuardian}
                    className="w-full rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "登録中..." : "児童を追加"}
                  </button>
                </form>
                <div className="mt-4 flex flex-wrap gap-2">
                  {students.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      まだ児童が登録されていません。
                    </p>
                  ) : (
                    students.map((child) => (
                      <span
                        key={child.id}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                      >
                        {child.name}
                        {child.grade ? ` / ${child.grade}` : ""}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div
                ref={attendanceRef}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    LIFF 申請フォーム
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">出欠連絡</h3>
                  <p className="text-sm text-slate-500">
                    日付とステータスを選んで送信します。
                  </p>
                </div>
                {canSendAttendance ? (
                  <form
                    onSubmit={handleAttendanceSubmit}
                    className="mt-4 space-y-3"
                  >
                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                      対象日
                      <input
                        type="date"
                        required
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={attendanceForm.requestedFor}
                        onChange={(e) =>
                          setAttendanceForm((prev) => ({
                            ...prev,
                            requestedFor: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                      児童
                      <select
                        required
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={attendanceForm.studentId}
                        onChange={(e) =>
                          setAttendanceForm((prev) => ({
                            ...prev,
                            studentId: e.target.value,
                          }))
                        }
                      >
                        <option value="">選択してください</option>
                        {students.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                            {child.grade ? ` / ${child.grade}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <p className="mb-2 text-xs text-slate-500">ステータス</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            "present",
                            "late",
                            "absent",
                            "unknown",
                          ] as AttendanceStatus[]
                        ).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() =>
                              setAttendanceForm((prev) => ({
                                ...prev,
                                status,
                              }))
                            }
                            className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                              attendanceForm.status === status
                                ? statusTone[status]
                                : "border border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {statusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                      メモ (任意)
                      <textarea
                        className="min-h-[70px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={attendanceForm.reason}
                        onChange={(e) =>
                          setAttendanceForm((prev) => ({
                            ...prev,
                            reason: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      disabled={loading}
                      className="w-full rounded-full bg-[#06c755] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-200"
                    >
                      {loading ? "送信中..." : "出欠を送信"}
                    </button>
                  </form>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    保護者を選択し、児童を登録すると出欠連絡ができます。
                  </p>
                )}
              </div>

              {refreshing ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500">
                  更新中...
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

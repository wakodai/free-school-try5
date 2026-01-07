"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createGuardian,
  createStudent,
  fetchMessages,
  listStudents,
  postMessage,
  submitAttendance,
} from "@/lib/api";
import type {
  AttendanceStatus,
  Guardian,
  Message,
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

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === "inbound";
  return (
    <div
      className={`flex ${isInbound ? "justify-end" : "justify-start"} text-sm`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
          isInbound
            ? "bg-emerald-50 text-emerald-900"
            : "bg-white text-slate-800 border border-slate-100"
        }`}
      >
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
          {isInbound ? "保護者 → 塾" : "塾 → 保護者"}
        </div>
        <div className="whitespace-pre-wrap leading-relaxed">{message.body}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function LiffPage() {
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [guardianForm, setGuardianForm] = useState({ name: "", phone: "" });
  const [studentForm, setStudentForm] = useState({
    name: "",
    grade: "",
    notes: "",
  });
  const [students, setStudents] = useState<Student[]>([]);
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
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" && localStorage.getItem("guardianProfile");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Guardian;
        setGuardian(parsed);
        setGuardianForm({
          name: parsed.name,
          phone: parsed.phone ?? "",
        });
      } catch {
        // ignore corrupted data
      }
    }
  }, []);

  const headline = useMemo(() => {
    if (guardian) {
      return `${guardian.name}さん、今日の出欠を送信してください。`;
    }
    return "LINE風フォームで出欠を送信できます";
  }, [guardian]);

  const storeGuardian = (profile: Guardian) => {
    setGuardian(profile);
    if (typeof window !== "undefined") {
      localStorage.setItem("guardianProfile", JSON.stringify(profile));
    }
  };

  const loadStudents = async (guardianId: string) => {
    setRefreshing(true);
    try {
      const data = await listStudents(guardianId);
      setStudents(data);
      if (!attendanceForm.studentId && data.length > 0) {
        setAttendanceForm((prev) => ({ ...prev, studentId: data[0].id }));
        setMessageStudentId((prev) => prev || data[0].id);
      }
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setRefreshing(false);
    }
  };

  const loadMessages = async (guardianId: string) => {
    try {
      const data = await fetchMessages({ guardianId });
      setMessages(data);
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    }
  };

  useEffect(() => {
    if (guardian?.id) {
      loadStudents(guardian.id);
      loadMessages(guardian.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardian?.id]);

  const handleGuardianSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setToast(null);
    try {
      const created = await createGuardian({
        name: guardianForm.name.trim(),
        phone: guardianForm.phone.trim() || undefined,
      });
      storeGuardian(created);
      setToast({ type: "success", message: "保護者情報を登録しました。" });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!guardian) return;
    setLoading(true);
    setToast(null);
    try {
      const created = await createStudent({
        name: studentForm.name.trim(),
        grade: studentForm.grade.trim() || undefined,
        notes: studentForm.notes.trim() || undefined,
        guardianId: guardian.id,
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
    if (!guardian || !attendanceForm.studentId) return;
    setLoading(true);
    setToast(null);
    try {
      await submitAttendance({
        guardianId: guardian.id,
        studentId: attendanceForm.studentId,
        requestedFor: attendanceForm.requestedFor,
        status: attendanceForm.status,
        reason: attendanceForm.reason.trim() || undefined,
      });
      setToast({ type: "success", message: "出欠を送信しました。" });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleMessageSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!guardian || !messageBody.trim()) return;
    setLoading(true);
    setToast(null);
    try {
      const created = await postMessage({
        guardianId: guardian.id,
        studentId: messageStudentId || undefined,
        direction: "inbound",
        body: messageBody.trim(),
      });
      setMessages((prev) => [created, ...prev]);
      setMessageBody("");
      setToast({ type: "success", message: "メッセージを送信しました。" });
    } catch (err) {
      setToast({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const clearProfile = () => {
    setGuardian(null);
    setStudents([]);
    setMessages([]);
    setAttendanceForm((prev) => ({
      ...prev,
      studentId: "",
      reason: "",
    }));
    if (typeof window !== "undefined") {
      localStorage.removeItem("guardianProfile");
    }
  };

  const canSendAttendance = guardian && students.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-white">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <header className="mb-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-600">
              LIFF style
            </p>
            <h1 className="text-3xl font-bold text-slate-900">{headline}</h1>
            <p className="text-sm text-slate-500">
              LINEがなくてもブラウザ上で完結。登録後はこの端末にプロフィールを保存します。
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              ホームへ戻る
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-emerald-600 px-4 py-2 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              スタッフ用ダッシュボード
            </Link>
          </div>
        </header>

        {toast ? (
          <div
            className={`mb-6 flex items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              toast.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-rose-100 bg-rose-50 text-rose-800"
            }`}
          >
            <span>{toast.message}</span>
            <button
              className="text-xs underline decoration-dotted"
              onClick={() => setToast(null)}
            >
              閉じる
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Section
              title="1. 保護者プロフィール"
              description="初回だけ入力してください。同じ端末では自動で再利用します。"
            >
              {guardian ? (
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {guardian.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      電話: {guardian.phone || "未登録"}
                    </p>
                    <p className="text-xs text-slate-400">
                      登録ID: {guardian.id.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={clearProfile}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      端末の登録をクリア
                    </button>
                    <button
                      onClick={() => guardian.id && loadStudents(guardian.id)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      最新情報を取得
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleGuardianSubmit}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <label className="flex flex-col gap-1 text-sm text-slate-700">
                    名前
                    <input
                      required
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base shadow-inner focus:border-emerald-400 focus:outline-none"
                      value={guardianForm.name}
                      onChange={(e) =>
                        setGuardianForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="山田 花子"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-700">
                    電話番号（任意）
                    <input
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-base shadow-inner focus:border-emerald-400 focus:outline-none"
                      value={guardianForm.phone}
                      onChange={(e) =>
                        setGuardianForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="090-xxxx-xxxx"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {loading ? "登録中..." : "登録する"}
                    </button>
                  </div>
                </form>
              )}
            </Section>

            <Section
              title="2. お子さまの登録"
              description="兄弟がいる場合もまとめて登録できます。"
            >
              {guardian ? (
                <div className="space-y-4">
                  <form
                    onSubmit={handleStudentSubmit}
                    className="grid gap-3 md:grid-cols-3"
                  >
                    <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-1">
                      児童名
                      <input
                        required
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-emerald-400 focus:outline-none"
                        value={studentForm.name}
                        onChange={(e) =>
                          setStudentForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="山田 太郎"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-slate-700">
                      学年（任意）
                      <input
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-emerald-400 focus:outline-none"
                        value={studentForm.grade}
                        onChange={(e) =>
                          setStudentForm((prev) => ({
                            ...prev,
                            grade: e.target.value,
                          }))
                        }
                        placeholder="中2 / 小5"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-slate-700">
                      メモ（任意）
                      <input
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-emerald-400 focus:outline-none"
                        value={studentForm.notes}
                        onChange={(e) =>
                          setStudentForm((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        placeholder="送迎あり / アレルギー等"
                      />
                    </label>
                    <div className="md:col-span-3">
                      <button
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {loading ? "保存中..." : "児童を追加"}
                      </button>
                    </div>
                  </form>
                  <div className="flex flex-wrap gap-3">
                    {students.map((child) => (
                      <span
                        key={child.id}
                        className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700"
                      >
                        {child.name}
                        {child.grade ? ` / ${child.grade}` : ""}
                      </span>
                    ))}
                    {students.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        まだ児童が登録されていません。
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  先に保護者プロフィールを登録してください。
                </p>
              )}
            </Section>

            <Section
              title="3. 出欠申請"
              description="日付と児童、ステータスを選んで送信します。"
            >
              {canSendAttendance ? (
                <form
                  onSubmit={handleAttendanceSubmit}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <label className="flex flex-col gap-2 text-sm text-slate-700">
                    対象日
                    <input
                      required
                      type="date"
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-emerald-400 focus:outline-none"
                      value={attendanceForm.requestedFor}
                      onChange={(e) =>
                        setAttendanceForm((prev) => ({
                          ...prev,
                          requestedFor: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-700">
                    児童を選択
                    <select
                      required
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-emerald-400 focus:outline-none"
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
                  <div className="md:col-span-2">
                    <p className="mb-2 text-sm text-slate-700">ステータス</p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {(
                        ["present", "late", "absent", "unknown"] as AttendanceStatus[]
                      ).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            setAttendanceForm((prev) => ({ ...prev, status }))
                          }
                          className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                            attendanceForm.status === status
                              ? statusTone[status]
                              : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                          }`}
                        >
                          {statusLabels[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-700">
                    メモ（任意）
                    <textarea
                      className="min-h-[96px] rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-emerald-400 focus:outline-none"
                      value={attendanceForm.reason}
                      onChange={(e) =>
                        setAttendanceForm((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                      placeholder="発熱のため欠席 など"
                    />
                  </label>
                  <div className="md:col-span-2">
                    <button
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {loading ? "送信中..." : "出欠を送信"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-slate-500">
                  保護者登録と児童の追加を済ませてから送信してください。
                </p>
              )}
            </Section>
          </div>

          <div className="space-y-6">
            <Section
              title="メッセージ（LINEモック）"
              description="テキストを送るとスタッフ側のダッシュボードに届きます。"
            >
              {guardian ? (
                <div className="space-y-4">
                  <form onSubmit={handleMessageSubmit} className="space-y-3">
                    <label className="flex flex-col gap-1 text-sm text-slate-700">
                      子ども（任意）
                      <select
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-emerald-400 focus:outline-none"
                        value={messageStudentId}
                        onChange={(e) => setMessageStudentId(e.target.value)}
                      >
                        <option value="">指定しない</option>
                        {students.map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <textarea
                      required
                      className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="メッセージを入力（例: 今日は少し遅れます）"
                    />
                    <button
                      disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {loading ? "送信中..." : "メッセージを送信"}
                    </button>
                  </form>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>最新メッセージ</span>
                    <button
                      onClick={() => guardian.id && loadMessages(guardian.id)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      更新
                    </button>
                  </div>
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 max-h-[320px] overflow-y-auto">
                    {messages.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        まだメッセージはありません。
                      </p>
                    ) : (
                      messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  先に保護者プロフィールを登録してください。
                </p>
              )}
            </Section>

            <Section
              title="小さなヒント"
              description="LINEアプリが使えなくても同じ体験を提供します。"
            >
              <ul className="space-y-2 text-sm text-slate-700">
                <li>・登録内容はこの端末に保存され、次回の入力が省けます。</li>
                <li>・ステータスは後から送信し直せば上書きされます。</li>
                <li>・メッセージはスタッフダッシュボードで即座に確認できます。</li>
              </ul>
              <div className="mt-3">
                <Link
                  href="/mock-line"
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  シンプルなLINEモックを開く
                  <span aria-hidden>↗</span>
                </Link>
              </div>
            </Section>

            {refreshing ? (
              <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-center text-sm text-slate-600 shadow-inner">
                更新中...
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

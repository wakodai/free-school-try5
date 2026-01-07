"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchAttendance,
  fetchMessages,
  fetchStats,
  listGuardians,
  listStudents,
  postMessage,
} from "@/lib/api";
import type {
  AttendanceRequest,
  AttendanceStats,
  AttendanceStatus,
  Guardian,
  Message,
  Student,
} from "@/types";

const statusLabel: Record<AttendanceStatus, string> = {
  present: "出席",
  absent: "欠席",
  late: "遅刻",
  unknown: "未定",
};

const statusBadge: Record<AttendanceStatus, string> = {
  present: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  absent: "bg-rose-50 text-rose-700 border border-rose-100",
  late: "bg-amber-50 text-amber-700 border border-amber-100",
  unknown: "bg-slate-100 text-slate-700 border border-slate-200",
};

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardPage() {
  const [targetDate, setTargetDate] = useState(today());
  const [attendance, setAttendance] = useState<AttendanceRequest[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [guardianFilter, setGuardianFilter] = useState("");
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [outboundGuardianId, setOutboundGuardianId] = useState("");
  const [outboundStudentId, setOutboundStudentId] = useState("");
  const [outboundBody, setOutboundBody] = useState("");
  const [studentOptions, setStudentOptions] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listGuardians();
        setGuardians(data);
        if (!outboundGuardianId && data.length > 0) {
          setOutboundGuardianId(data[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshAttendance(targetDate);
    refreshStats(targetDate);
  }, [targetDate]);

  useEffect(() => {
    refreshMessages(guardianFilter);
  }, [guardianFilter]);

  const refreshAttendance = async (date: string) => {
    setLoading(true);
    try {
      const data = await fetchAttendance({ date });
      setAttendance(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshStats = async (date: string) => {
    try {
      const data = await fetchStats({ date });
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const refreshMessages = async (guardianId: string) => {
    setLoadingMessages(true);
    try {
      const data = await fetchMessages({
        guardianId: guardianId || undefined,
      });
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadStudentsForGuardian = async (guardianId: string) => {
    if (!guardianId) {
      setStudentOptions([]);
      setOutboundStudentId("");
      return;
    }
    try {
      const data = await listStudents(guardianId);
      setStudentOptions(data);
      if (!outboundStudentId && data.length > 0) {
        setOutboundStudentId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadStudentsForGuardian(outboundGuardianId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundGuardianId]);

  const sendOutboundMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!outboundGuardianId || !outboundBody.trim()) return;
    setLoadingMessages(true);
    try {
      const created = await postMessage({
        guardianId: outboundGuardianId,
        studentId: outboundStudentId || undefined,
        direction: "outbound",
        body: outboundBody.trim(),
      });
      setMessages((prev) => [created, ...prev]);
      setOutboundBody("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const overallRate = useMemo(() => {
    if (!stats || stats.overall.total === 0) return 0;
    return Math.round(
      (stats.overall.present / stats.overall.total + Number.EPSILON) * 100,
    );
  }, [stats]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <header className="mb-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Dashboard
            </p>
            <h1 className="text-3xl font-bold text-slate-900">
              出欠とメッセージのダッシュボード
            </h1>
            <p className="text-sm text-slate-500">
              今日の出欠、児童別の状況、LINEモックからのメッセージをまとめて確認できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/liff"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              保護者UIへ
            </Link>
            <Link
              href="/mock-line"
              className="rounded-full bg-emerald-600 px-4 py-2 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              LINEモックを開く
            </Link>
          </div>
        </header>

        <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">
              日付
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
            />
            <button
              onClick={() => refreshAttendance(targetDate)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              更新
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>受信メッセージの絞り込み</span>
            <select
              value={guardianFilter}
              onChange={(e) => setGuardianFilter(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
            >
              <option value="">すべて</option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              出席率
            </p>
            <p className="mt-2 text-4xl font-bold text-emerald-900">
              {overallRate}%
            </p>
            <p className="text-sm text-emerald-700">
              全体 {stats?.overall.total ?? 0} 件中{" "}
              {stats?.overall.present ?? 0} 件が出席
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              欠席
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {stats?.overall.absent ?? 0}
            </p>
            <p className="text-sm text-slate-500">欠席件数</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              遅刻
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {stats?.overall.late ?? 0}
            </p>
            <p className="text-sm text-slate-500">遅刻連絡</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              未定
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {stats?.overall.unknown ?? 0}
            </p>
            <p className="text-sm text-slate-500">まだ未確定の件数</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  今日の出欠一覧
                </h2>
                <p className="text-sm text-slate-500">
                  日付の変更は上部のフィルターから行えます。
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {attendance.length} 件
              </span>
            </div>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">読み込み中...</p>
              ) : attendance.length === 0 ? (
                <p className="text-sm text-slate-500">
                  出欠はまだ登録されていません。
                </p>
              ) : (
                attendance.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {entry.student?.name ?? "児童不明"}
                        </p>
                        <p className="text-xs text-slate-500">
                          保護者: {entry.guardian?.name ?? "不明"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge[entry.status]}`}
                      >
                        {statusLabel[entry.status]}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      日付: {entry.requestedFor}
                    </div>
                    {entry.reason ? (
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">
                        {entry.reason}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  児童別の状況
                </h2>
                <p className="text-sm text-slate-500">
                  同日内の集計。割合の高い順に表示します。
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {stats?.byStudent.length ? (
                stats.byStudent
                  .slice()
                  .sort(
                    (a, b) =>
                      (b.present / Math.max(b.total, 1)) -
                      (a.present / Math.max(a.total, 1)),
                  )
                  .map((row) => {
                    const rate =
                      row.total === 0
                        ? 0
                        : Math.round(
                            (row.present / row.total + Number.EPSILON) * 100,
                          );
                    return (
                      <div
                        key={row.student.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {row.student.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {row.student.grade ?? "学年未設定"}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-emerald-700">
                            {rate}%
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                          <span>出席 {row.present}</span>
                          <span>欠席 {row.absent}</span>
                          <span>遅刻 {row.late}</span>
                          <span>未定 {row.unknown}</span>
                          <span className="text-slate-500">合計 {row.total}</span>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <p className="text-sm text-slate-500">
                  集計できるデータがありません。
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  メッセージ受信履歴
                </h2>
                <p className="text-sm text-slate-500">
                  LINEモックやLIFFから送られたテキストを一覧表示します。
                </p>
              </div>
              <button
                onClick={() => refreshMessages(guardianFilter)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                再読み込み
              </button>
            </div>
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {loadingMessages ? (
                <p className="text-sm text-slate-500">読み込み中...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-slate-500">
                  受信メッセージはまだありません。
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            message.direction === "inbound"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          }`}
                        >
                          {message.direction === "inbound"
                            ? "Inbound"
                            : "Outbound"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {message.createdAt
                            ? new Date(message.createdAt).toLocaleString()
                            : ""}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {message.guardianId.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      保護者:{" "}
                      {guardians.find((g) => g.id === message.guardianId)?.name ??
                        "不明"}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap leading-relaxed">
                      {message.body}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-slate-900">
                返信を送る
              </h2>
              <p className="text-sm text-slate-500">
                モック側にアウトバウンドとして保存されます。
              </p>
            </div>
            <form onSubmit={sendOutboundMessage} className="space-y-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                保護者
                <select
                  required
                  value={outboundGuardianId}
                  onChange={(e) => {
                    setOutboundGuardianId(e.target.value);
                    setOutboundStudentId("");
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">選択してください</option>
                  {guardians.map((guardian) => (
                    <option key={guardian.id} value={guardian.id}>
                      {guardian.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                児童（任意）
                <select
                  value={outboundStudentId}
                  onChange={(e) => setOutboundStudentId(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">指定しない</option>
                  {studentOptions.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                本文
                <textarea
                  required
                  className="min-h-[120px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                  placeholder="ご連絡ありがとうございます、承知しました。"
                  value={outboundBody}
                  onChange={(e) => setOutboundBody(e.target.value)}
                />
              </label>
              <button
                disabled={loadingMessages || !outboundGuardianId}
                className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loadingMessages ? "送信中..." : "返信を送信"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

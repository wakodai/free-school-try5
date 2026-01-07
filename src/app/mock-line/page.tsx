"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createGuardian,
  createStudent,
  fetchMessages,
  listGuardians,
  listStudents,
  postMessage,
} from "@/lib/api";
import type { Guardian, Message, MessageDirection, Student } from "@/types";

const directionLabel: Record<MessageDirection, string> = {
  inbound: "保護者 → 塾",
  outbound: "塾 → 保護者",
};

export default function MockLinePage() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [direction, setDirection] = useState<MessageDirection>("inbound");
  const [body, setBody] = useState("");
  const [newGuardianName, setNewGuardianName] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [loading, setLoading] = useState(false);

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

  const loadGuardians = async () => {
    try {
      const data = await listGuardians();
      setGuardians(data);
      if (!selectedGuardianId && data.length > 0) {
        setSelectedGuardianId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudents = async (guardianId: string) => {
    try {
      const data = await listStudents(guardianId);
      setStudents(data);
      if (!selectedStudentId && data.length > 0) {
        setSelectedStudentId(data[0].id);
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

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedGuardianId || !body.trim()) return;
    setLoading(true);
    try {
      const created = await postMessage({
        guardianId: selectedGuardianId,
        studentId: selectedStudentId || undefined,
        direction,
        body: body.trim(),
      });
      setMessages((prev) => [created, ...prev]);
      setBody("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGuardian = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newGuardianName.trim()) return;
    setLoading(true);
    try {
      const created = await createGuardian({ name: newGuardianName.trim() });
      setGuardians((prev) => [created, ...prev]);
      setSelectedGuardianId(created.id);
      setNewGuardianName("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedGuardianId || !newStudentName.trim()) return;
    setLoading(true);
    try {
      const created = await createStudent({
        name: newStudentName.trim(),
        guardianId: selectedGuardianId,
      });
      setStudents((prev) => [created, ...prev]);
      setSelectedStudentId(created.id);
      setNewStudentName("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeGuardian = guardians.find((g) => g.id === selectedGuardianId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <header className="mb-8 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-indigo-600">
              LINE mock
            </p>
            <h1 className="text-3xl font-bold text-slate-900">
              LINEモックで送受信を試す
            </h1>
            <p className="text-sm text-slate-500">
              保護者を選んでメッセージを送信。ダッシュボードへ即時反映されます。
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href="/liff"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              LIFF風フォーム
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full bg-slate-900 px-4 py-2 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              ダッシュボードへ
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900">
                保護者を選択
              </h2>
              <p className="text-sm text-slate-500">
                既存の保護者を選ぶか、新規作成してください。
              </p>
              <select
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                value={selectedGuardianId}
                onChange={(e) => setSelectedGuardianId(e.target.value)}
              >
                {guardians.length === 0 ? (
                  <option value="">保護者が未登録です</option>
                ) : null}
                {guardians.map((guardian) => (
                  <option key={guardian.id} value={guardian.id}>
                    {guardian.name}
                  </option>
                ))}
              </select>
              <form onSubmit={handleCreateGuardian} className="mt-4 space-y-3">
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  新しく登録
                  <input
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-indigo-400 focus:outline-none"
                    placeholder="田中 保護者"
                    value={newGuardianName}
                    onChange={(e) => setNewGuardianName(e.target.value)}
                  />
                </label>
                <button
                  disabled={loading}
                  className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {loading ? "作成中..." : "保護者を追加"}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
              <h2 className="text-lg font-semibold text-slate-900">児童</h2>
              <p className="text-sm text-slate-500">
                送信先を明確にしたいときは児童を紐付けてください。
              </p>
              <select
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={students.length === 0}
              >
                <option value="">指定しない</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <form onSubmit={handleCreateStudent} className="mt-4 space-y-3">
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  児童を追加
                  <input
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-inner focus:border-indigo-400 focus:outline-none"
                    placeholder="佐藤 一郎"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    disabled={!selectedGuardianId}
                  />
                </label>
                <button
                  disabled={loading || !selectedGuardianId}
                  className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {loading ? "作成中..." : "児童を追加"}
                </button>
              </form>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    メッセージを送信
                  </h2>
                  <p className="text-sm text-slate-500">
                    方向を切り替えて受信・送信の両方を試せます。
                  </p>
                </div>
                <div className="flex gap-2">
                  {(["inbound", "outbound"] as MessageDirection[]).map(
                    (d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDirection(d)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          direction === d
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {directionLabel[d]}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <form onSubmit={handleSend} className="space-y-3">
                <textarea
                  required
                  className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  placeholder="例: 今日の欠席連絡です"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {activeGuardian
                      ? `${activeGuardian.name}宛てに送信`
                      : "保護者を選択してください"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() =>
                        selectedGuardianId && loadMessages(selectedGuardianId)
                      }
                    >
                      更新
                    </button>
                    <button
                      disabled={loading || !selectedGuardianId}
                      className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                    >
                      {loading ? "送信中..." : "送信する"}
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    タイムライン
                  </h2>
                  <p className="text-sm text-slate-500">
                    新しい順に表示します。ダッシュボードと同じデータを参照しています。
                  </p>
                </div>
              </div>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    まだメッセージがありません。
                  </p>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="flex items-start gap-3">
                      <div
                        className={`mt-1 h-2 w-2 rounded-full ${
                          message.direction === "inbound"
                            ? "bg-emerald-500"
                            : "bg-indigo-500"
                        }`}
                      />
                      <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-800">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                          <span>{directionLabel[message.direction]}</span>
                          <span>
                            {message.createdAt
                              ? new Date(message.createdAt).toLocaleString()
                              : ""}
                          </span>
                        </div>
                        <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                          {message.body}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

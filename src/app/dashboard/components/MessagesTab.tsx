"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMessages,
  listGuardians,
  listStudents,
  postMessage,
} from "@/lib/api";
import type { Guardian, Message, Student } from "@/types";
import { ListSkeleton } from "./Skeleton";
import { ErrorAlert } from "./ErrorAlert";

export function MessagesTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [guardianFilter, setGuardianFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [outboundGuardianId, setOutboundGuardianId] = useState("");
  const [outboundStudentId, setOutboundStudentId] = useState("");
  const [outboundBody, setOutboundBody] = useState("");
  const [studentOptions, setStudentOptions] = useState<Student[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const loadGuardians = async () => {
      try {
        const data = await listGuardians();
        setGuardians(data);
        if (data.length > 0) {
          setOutboundGuardianId(data[0].id);
        }
      } catch (err) {
        console.error("[MessagesTab] 保護者一覧取得エラー:", err);
      }
    };
    loadGuardians();
  }, []);

  const loadMessages = useCallback(async (guardianId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMessages({
        guardianId: guardianId || undefined,
      });
      setMessages(data);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "メッセージの取得に失敗しました";
      console.error("[MessagesTab] メッセージ取得エラー:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages(guardianFilter);
  }, [guardianFilter, loadMessages]);

  useEffect(() => {
    if (!outboundGuardianId) {
      setStudentOptions([]);
      setOutboundStudentId("");
      return;
    }
    const loadStudents = async () => {
      try {
        const data = await listStudents({ guardianId: outboundGuardianId });
        setStudentOptions(data);
        if (data.length > 0) {
          setOutboundStudentId(data[0].id);
        }
      } catch (err) {
        console.error("[MessagesTab] 児童一覧取得エラー:", err);
      }
    };
    loadStudents();
  }, [outboundGuardianId]);

  const sendOutboundMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!outboundGuardianId || !outboundBody.trim()) return;
    setSending(true);
    setSendError(null);
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
      const message =
        err instanceof Error ? err.message : "メッセージの送信に失敗しました";
      console.error("[MessagesTab] メッセージ送信エラー:", err);
      setSendError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>保護者で絞り込み</span>
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
        <button
          onClick={() => loadMessages(guardianFilter)}
          disabled={loading}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          再読み込み
        </button>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          onRetry={() => loadMessages(guardianFilter)}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              メッセージ履歴
            </h2>
            <p className="text-sm text-slate-500">
              保護者から送られたメッセージとスタッフからの返信を一覧表示します。
            </p>
          </div>
          <div className="max-h-[480px] space-y-3 overflow-y-auto">
            {loading ? (
              <ListSkeleton rows={4} />
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500">
                メッセージはまだありません。
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
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                          message.direction === "inbound"
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                            : "border-indigo-100 bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        {message.direction === "inbound" ? "受信" : "送信"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {message.createdAt
                          ? new Date(message.createdAt).toLocaleString()
                          : ""}
                      </span>
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
              保護者へメッセージを送信します。
            </p>
          </div>
          {sendError && (
            <div className="mb-3">
              <ErrorAlert message={sendError} />
            </div>
          )}
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
              disabled={sending || !outboundGuardianId}
              className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sending ? "送信中..." : "返信を送信"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

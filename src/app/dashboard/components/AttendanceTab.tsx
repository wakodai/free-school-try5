"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAttendance } from "@/lib/api";
import type { AttendanceRequest, AttendanceStatus } from "@/types";
import { ListSkeleton } from "./Skeleton";
import { ErrorAlert } from "./ErrorAlert";

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

export function AttendanceTab() {
  const [targetDate, setTargetDate] = useState(today());
  const [attendance, setAttendance] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAttendance = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendance({ date });
      setAttendance(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "出欠データの取得に失敗しました";
      console.error("[AttendanceTab] 出欠データ取得エラー:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendance(targetDate);
  }, [targetDate, loadAttendance]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">日付</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
          />
          <button
            onClick={() => loadAttendance(targetDate)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            更新
          </button>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {attendance.length} 件
        </span>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          onRetry={() => loadAttendance(targetDate)}
        />
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">出欠一覧</h2>
          <p className="text-sm text-slate-500">
            日付を変更して出欠状況を確認できます。
          </p>
        </div>
        <div className="space-y-3">
          {loading ? (
            <ListSkeleton rows={4} />
          ) : attendance.length === 0 ? (
            <p className="text-sm text-slate-500">
              この日の出欠はまだ登録されていません。
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
                {entry.reason && (
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">
                    {entry.reason}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

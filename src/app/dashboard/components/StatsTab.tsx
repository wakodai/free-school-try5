"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStats } from "@/lib/api";
import type { AttendanceStats } from "@/types";
import { StatsSkeleton, ListSkeleton } from "./Skeleton";
import { ErrorAlert } from "./ErrorAlert";

function today() {
  return new Date().toISOString().split("T")[0];
}

export function StatsTab() {
  const [targetDate, setTargetDate] = useState(today());
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStats({ date });
      setStats(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "統計データの取得に失敗しました";
      console.error("[StatsTab] 統計データ取得エラー:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats(targetDate);
  }, [targetDate, loadStats]);

  const overallRate = useMemo(() => {
    if (!stats || stats.overall.total === 0) return 0;
    return Math.round(
      (stats.overall.present / stats.overall.total + Number.EPSILON) * 100,
    );
  }, [stats]);

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
            onClick={() => loadStats(targetDate)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            更新
          </button>
        </div>
      </div>

      {error && (
        <ErrorAlert message={error} onRetry={() => loadStats(targetDate)} />
      )}

      {loading ? (
        <StatsSkeleton />
      ) : (
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
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            児童別の状況
          </h2>
          <p className="text-sm text-slate-500">
            出席率の高い順に表示します。
          </p>
        </div>
        <div className="space-y-3">
          {loading ? (
            <ListSkeleton rows={3} />
          ) : stats?.byStudent.length ? (
            stats.byStudent
              .slice()
              .sort(
                (a, b) =>
                  b.present / Math.max(b.total, 1) -
                  a.present / Math.max(a.total, 1),
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
  );
}

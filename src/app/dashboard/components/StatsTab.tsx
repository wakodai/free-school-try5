"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStats } from "@/lib/api";
import type { AttendanceStats, StatusCounts } from "@/types";
import { StatsSkeleton, ListSkeleton } from "./Skeleton";
import { ErrorAlert } from "./ErrorAlert";

function currentMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(monthStr: string): { from: string; to: string } {
  const [y, m] = monthStr.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${String(m).padStart(2, "0")}-01`,
    to: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function calcRate(counts: StatusCounts): number {
  if (counts.total === 0) return 0;
  return Math.round((counts.present / counts.total + Number.EPSILON) * 100);
}

function rateColor(rate: number): string {
  if (rate >= 80) return "bg-emerald-500";
  if (rate >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function rateTextColor(rate: number): string {
  if (rate >= 80) return "text-emerald-700";
  if (rate >= 50) return "text-amber-600";
  return "text-rose-600";
}

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  return `${y}年${m}月`;
}

export function StatsTab() {
  const [month, setMonth] = useState(currentMonth());
  const [monthlyStats, setMonthlyStats] = useState<AttendanceStats | null>(
    null,
  );
  const [allTimeStats, setAllTimeStats] = useState<AttendanceStats | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const range = monthRange(m);
      const [monthly, allTime] = await Promise.all([
        fetchStats({ from: range.from, to: range.to }),
        fetchStats({}),
      ]);
      setMonthlyStats(monthly);
      setAllTimeStats(allTime);
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
    loadStats(month);
  }, [month, loadStats]);

  const monthlyRate = useMemo(
    () => (monthlyStats ? calcRate(monthlyStats.overall) : 0),
    [monthlyStats],
  );
  const allTimeRate = useMemo(
    () => (allTimeStats ? calcRate(allTimeStats.overall) : 0),
    [allTimeStats],
  );

  const mergedStudents = useMemo(() => {
    if (!monthlyStats && !allTimeStats) return [];

    const studentMap = new Map<
      string,
      {
        student: { id: string; name: string; grade?: string | null };
        monthly: StatusCounts | null;
        allTime: StatusCounts | null;
      }
    >();

    for (const row of allTimeStats?.byStudent ?? []) {
      studentMap.set(row.student.id, {
        student: row.student,
        monthly: null,
        allTime: row,
      });
    }

    for (const row of monthlyStats?.byStudent ?? []) {
      const existing = studentMap.get(row.student.id);
      if (existing) {
        existing.monthly = row;
      } else {
        studentMap.set(row.student.id, {
          student: row.student,
          monthly: row,
          allTime: null,
        });
      }
    }

    return [...studentMap.values()].sort((a, b) => {
      const rateA = a.allTime ? calcRate(a.allTime) : a.monthly ? calcRate(a.monthly) : 0;
      const rateB = b.allTime ? calcRate(b.allTime) : b.monthly ? calcRate(b.monthly) : 0;
      return rateA - rateB;
    });
  }, [monthlyStats, allTimeStats]);

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">
            対象月
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
          />
          <button
            onClick={() => loadStats(month)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            更新
          </button>
        </div>
      </div>

      {error && (
        <ErrorAlert message={error} onRetry={() => loadStats(month)} />
      )}

      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Monthly Stats */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              月間統計 ({formatMonthLabel(month)})
            </h3>
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                出席率
              </p>
              <p className="mt-2 text-4xl font-bold text-emerald-900">
                {monthlyRate}%
              </p>
              <p className="text-sm text-emerald-700">
                全体 {monthlyStats?.overall.total ?? 0} 件中{" "}
                {monthlyStats?.overall.present ?? 0} 件が出席
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  出欠登録数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {monthlyStats?.overall.total ?? 0}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                  欠席数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {monthlyStats?.overall.absent ?? 0}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                  遅刻数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {monthlyStats?.overall.late ?? 0}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  未連絡数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {monthlyStats?.overall.unknown ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* All-Time Stats */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              全期間統計
            </h3>
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                出席率
              </p>
              <p className="mt-2 text-4xl font-bold text-emerald-900">
                {allTimeRate}%
              </p>
              <p className="text-sm text-emerald-700">
                全体 {allTimeStats?.overall.total ?? 0} 件中{" "}
                {allTimeStats?.overall.present ?? 0} 件が出席
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  出欠登録数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {allTimeStats?.overall.total ?? 0}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                  欠席数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {allTimeStats?.overall.absent ?? 0}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
                  遅刻数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {allTimeStats?.overall.late ?? 0}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  未連絡数
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {allTimeStats?.overall.unknown ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-Student Attendance Rates */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            児童別出席率
          </h2>
          <p className="text-sm text-slate-500">
            出席率の低い順に表示します（要フォロー児童が上位）。
          </p>
        </div>
        <div className="space-y-3">
          {loading ? (
            <ListSkeleton rows={3} />
          ) : mergedStudents.length ? (
            mergedStudents.map((entry) => {
              const mRate = entry.monthly ? calcRate(entry.monthly) : null;
              const aRate = entry.allTime ? calcRate(entry.allTime) : null;
              return (
                <div
                  key={entry.student.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {entry.student.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.student.grade ?? "学年未設定"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {/* Monthly rate */}
                    <div className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-xs text-slate-500">
                        月間
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-slate-200">
                        {mRate !== null && (
                          <div
                            className={`h-2 rounded-full ${rateColor(mRate)}`}
                            style={{ width: `${mRate}%` }}
                          />
                        )}
                      </div>
                      <span
                        className={`w-12 text-right text-sm font-bold ${mRate !== null ? rateTextColor(mRate) : "text-slate-400"}`}
                      >
                        {mRate !== null ? `${mRate}%` : "-"}
                      </span>
                    </div>
                    {/* All-time rate */}
                    <div className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-xs text-slate-500">
                        全期間
                      </span>
                      <div className="h-2 flex-1 rounded-full bg-slate-200">
                        {aRate !== null && (
                          <div
                            className={`h-2 rounded-full ${rateColor(aRate)}`}
                            style={{ width: `${aRate}%` }}
                          />
                        )}
                      </div>
                      <span
                        className={`w-12 text-right text-sm font-bold ${aRate !== null ? rateTextColor(aRate) : "text-slate-400"}`}
                      >
                        {aRate !== null ? `${aRate}%` : "-"}
                      </span>
                    </div>
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

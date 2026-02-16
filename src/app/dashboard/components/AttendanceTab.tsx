"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAttendance, listStudents } from "@/lib/api";
import type { AttendanceRequest, AttendanceStatus, Student } from "@/types";
import { ListSkeleton } from "./Skeleton";
import { ErrorAlert } from "./ErrorAlert";

const statusSymbol: Record<AttendanceStatus, { label: string; cls: string }> = {
  present: { label: "●", cls: "text-emerald-600" },
  absent: { label: "●", cls: "text-rose-500" },
  late: { label: "●", cls: "text-amber-500" },
  unknown: { label: "●", cls: "text-slate-400" },
};

const statusLegend: { status: AttendanceStatus; label: string; cls: string }[] = [
  { status: "present", label: "出席", cls: "text-emerald-600" },
  { status: "absent", label: "欠席", cls: "text-rose-500" },
  { status: "late", label: "遅刻", cls: "text-amber-500" },
  { status: "unknown", label: "未定", cls: "text-slate-400" },
];

const dayOfWeekLabels = ["日", "月", "火", "水", "木", "金", "土"];

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getDaysInMonth(yearMonth: string): Date[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const days: Date[] = [];
  const date = new Date(y, m - 1, 1);
  while (date.getMonth() === m - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y, m, 0);
  return formatDate(last);
}

export function AttendanceTab() {
  const [targetMonth, setTargetMonth] = useState(getCurrentMonth);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const from = `${month}-01`;
      const to = getLastDayOfMonth(month);
      const [studentsData, attendanceData] = await Promise.all([
        listStudents(),
        fetchAttendance({ from, to }),
      ]);
      setStudents(studentsData);
      setAttendance(attendanceData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "データの取得に失敗しました";
      console.error("[AttendanceTab] データ取得エラー:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(targetMonth);
  }, [targetMonth, loadData]);

  const days = getDaysInMonth(targetMonth);

  // Build O(1) lookup map: "studentId:YYYY-MM-DD" -> AttendanceStatus
  const attendanceMap = new Map<string, AttendanceStatus>();
  for (const entry of attendance) {
    attendanceMap.set(`${entry.studentId}:${entry.requestedFor}`, entry.status);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/90 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">月</label>
          <input
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
          />
          <button
            onClick={() => loadData(targetMonth)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            更新
          </button>
        </div>
        <div className="flex items-center gap-3">
          {statusLegend.map((item) => (
            <span key={item.status} className="flex items-center gap-1 text-xs text-slate-600">
              <span className={item.cls}>●</span>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <ErrorAlert
          message={error}
          onRetry={() => loadData(targetMonth)}
        />
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : students.length === 0 ? (
          <p className="text-sm text-slate-500">生徒が登録されていません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[120px] border-b border-r border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700">
                    生徒名
                  </th>
                  {days.map((d) => {
                    const dow = d.getDay();
                    const bgCls =
                      dow === 0
                        ? "bg-rose-50"
                        : dow === 6
                          ? "bg-blue-50"
                          : "bg-white";
                    return (
                      <th
                        key={d.getDate()}
                        className={`min-w-[40px] border-b border-slate-200 px-1 py-2 text-center text-xs font-medium ${bgCls}`}
                      >
                        <div className="text-slate-700">{d.getDate()}</div>
                        <div
                          className={
                            dow === 0
                              ? "text-rose-500"
                              : dow === 6
                                ? "text-blue-500"
                                : "text-slate-400"
                          }
                        >
                          {dayOfWeekLabels[dow]}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr
                    key={student.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
                  >
                    <td className="sticky left-0 z-10 min-w-[120px] border-r border-slate-200 px-3 py-2 text-sm font-medium text-slate-800"
                      style={{ backgroundColor: idx % 2 === 0 ? "white" : "rgb(248 250 252 / 0.5)" }}
                    >
                      {student.name}
                    </td>
                    {days.map((d) => {
                      const key = `${student.id}:${formatDate(d)}`;
                      const status = attendanceMap.get(key);
                      const dow = d.getDay();
                      const bgCls =
                        dow === 0
                          ? "bg-rose-50/50"
                          : dow === 6
                            ? "bg-blue-50/50"
                            : "";
                      return (
                        <td
                          key={d.getDate()}
                          className={`min-w-[40px] px-1 py-2 text-center ${bgCls}`}
                        >
                          {status ? (
                            <span className={`text-base ${statusSymbol[status].cls}`}>
                              {statusSymbol[status].label}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

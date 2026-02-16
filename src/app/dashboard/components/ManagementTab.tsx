"use client";

import { useCallback, useEffect, useState } from "react";
import { listGuardians, listStudents, deleteStudent, deleteGuardian } from "@/lib/api";
import type { Guardian, Student } from "@/types";
import { ListSkeleton } from "./Skeleton";
import { ErrorAlert } from "./ErrorAlert";

export function ManagementTab() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [guardiansData, studentsData] = await Promise.all([
        listGuardians(),
        listStudents({ withGuardian: true }),
      ]);
      setGuardians(guardiansData);
      setStudents(studentsData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "データの取得に失敗しました";
      console.error("[ManagementTab] データ取得エラー:", err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteStudent = async (student: Student) => {
    if (!window.confirm(`${student.name}を削除しますか？出欠記録も削除されます。`)) {
      return;
    }
    setDeletingId(student.id);
    try {
      await deleteStudent(student.id);
      await loadData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "削除に失敗しました";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteGuardian = async (guardian: Guardian) => {
    const gStudents = guardianStudentsMap.get(guardian.id) ?? [];
    const studentNames = gStudents.map((s) => s.name).join("、");
    const msg = gStudents.length > 0
      ? `${guardian.name}を削除しますか？\n紐づく生徒（${studentNames}）と出欠記録もすべて削除されます。`
      : `${guardian.name}を削除しますか？`;
    if (!window.confirm(msg)) {
      return;
    }
    setDeletingId(guardian.id);
    try {
      await deleteGuardian(guardian.id);
      await loadData();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "削除に失敗しました";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  // Group students by guardian
  const guardianStudentsMap = new Map<string, Student[]>();
  const unassignedStudents: Student[] = [];

  for (const student of students) {
    if (student.guardian) {
      const list = guardianStudentsMap.get(student.guardian.id) ?? [];
      list.push(student);
      guardianStudentsMap.set(student.guardian.id, list);
    } else {
      unassignedStudents.push(student);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <ErrorAlert message={error} onRetry={loadData} />
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : guardians.length === 0 && students.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">保護者・生徒が登録されていません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {guardians.map((guardian) => {
            const gStudents = guardianStudentsMap.get(guardian.id) ?? [];
            return (
              <GuardianCard
                key={guardian.id}
                guardian={guardian}
                students={gStudents}
                deletingId={deletingId}
                onDeleteStudent={handleDeleteStudent}
                onDeleteGuardian={handleDeleteGuardian}
              />
            );
          })}

          {unassignedStudents.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-amber-800">
                保護者未設定
              </h3>
              <StudentTable
                students={unassignedStudents}
                deletingId={deletingId}
                onDelete={handleDeleteStudent}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GuardianCard({
  guardian,
  students,
  deletingId,
  onDeleteStudent,
  onDeleteGuardian,
}: {
  guardian: Guardian;
  students: Student[];
  deletingId: string | null;
  onDeleteStudent: (student: Student) => void;
  onDeleteGuardian: (guardian: Guardian) => void;
}) {
  const createdDate = new Date(guardian.createdAt).toLocaleDateString("ja-JP");
  const lineLinked = !!guardian.lineUserId;
  const isDeleting = deletingId === guardian.id;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {guardian.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {guardian.phone && <span>{guardian.phone}</span>}
            <span
              className={
                lineLinked
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-slate-500"
              }
            >
              {lineLinked ? "LINE連携済" : "LINE未連携"}
            </span>
            <span>登録日: {createdDate}</span>
          </div>
        </div>
        <button
          onClick={() => onDeleteGuardian(guardian)}
          disabled={isDeleting}
          className="self-start rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 sm:self-auto"
        >
          {isDeleting ? "削除中..." : "保護者を削除"}
        </button>
      </div>

      {students.length > 0 ? (
        <StudentTable
          students={students}
          deletingId={deletingId}
          onDelete={onDeleteStudent}
        />
      ) : (
        <p className="mt-3 text-xs text-slate-400">紐づく生徒はいません</p>
      )}
    </div>
  );
}

function StudentTable({
  students,
  deletingId,
  onDelete,
}: {
  students: Student[];
  deletingId: string | null;
  onDelete: (student: Student) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
              名前
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
              学年
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">
              メモ
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.id}
              className="border-b border-slate-100 last:border-b-0"
            >
              <td className="px-3 py-2 font-medium text-slate-800">
                {student.name}
              </td>
              <td className="px-3 py-2 text-slate-600">
                {student.grade ?? "-"}
              </td>
              <td className="px-3 py-2 text-slate-500">
                {student.notes ?? "-"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onDelete(student)}
                  disabled={deletingId === student.id}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  {deletingId === student.id ? "削除中..." : "削除"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

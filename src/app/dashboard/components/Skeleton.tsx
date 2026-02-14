"use client";

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-16 rounded bg-slate-200" />
      <div className="mt-3 h-8 w-20 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-32 rounded bg-slate-200" />
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-1 h-3 w-16 rounded bg-slate-200" />
            </div>
            <div className="h-6 w-12 rounded-full bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <div className="animate-pulse rounded-3xl border border-emerald-100 bg-emerald-50/80 p-5 shadow-sm">
        <div className="h-3 w-16 rounded bg-emerald-200" />
        <div className="mt-3 h-10 w-20 rounded bg-emerald-200" />
        <div className="mt-2 h-3 w-32 rounded bg-emerald-200" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

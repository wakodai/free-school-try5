"use client";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-rose-700">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
          >
            再試行
          </button>
        )}
      </div>
    </div>
  );
}

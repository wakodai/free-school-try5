export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div className="mx-auto max-w-5xl px-4 py-16 md:px-8">
        <header className="mb-12 space-y-4">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-600">
            Free School Attendance
          </p>
          <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            無料塾の出欠をLINEなしで。
            <br />
            ブラウザだけで保護者とつながるMVP。
          </h1>
          <p className="max-w-3xl text-lg text-slate-600">
            LIFF風フォームで保護者が出欠連絡・メッセージを送信し、スタッフはダッシュボードで一覧と統計、返信を確認できます。
            LINEアカウントがなくてもモックUIで体験できます。
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href="/liff"
              className="rounded-full bg-emerald-600 px-5 py-3 font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-700"
            >
              保護者向け LIFF風フォームを開く
            </a>
            <a
              href="/dashboard"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              スタッフダッシュボードへ
            </a>
            <a
              href="/mock-line"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3 font-semibold text-emerald-800 transition hover:-translate-y-0.5 hover:shadow-sm"
            >
              LINEモックを試す
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-emerald-700">
              保護者 UI
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              ワンクリックで出欠申請
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              児童登録・日付・ステータスを選ぶだけ。端末にプロフィールを保存し、LINEなしで送信できます。
            </p>
            <a
              href="/liff"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4"
            >
              開く ↗
            </a>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              ダッシュボード
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              出欠一覧と統計を即座に確認
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              今日の出欠、児童別の出席率、メッセージ受信履歴を一目で把握。LINEモックへの返信も可能です。
            </p>
            <a
              href="/dashboard"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 underline decoration-slate-300 decoration-2 underline-offset-4"
            >
              開く ↗
            </a>
          </div>
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-6 shadow-sm backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-emerald-700">
              LINEモック
            </p>
            <h2 className="mt-2 text-xl font-semibold text-emerald-900">
              テスト用のチャット環境
            </h2>
            <p className="mt-2 text-sm text-emerald-800">
              保護者を選んで inbound/outbound メッセージを送信。ダッシュボードとの連動を素早く試せます。
            </p>
            <a
              href="/mock-line"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 underline decoration-emerald-400 decoration-2 underline-offset-4"
            >
              開く ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

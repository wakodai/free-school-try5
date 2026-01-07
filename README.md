# 無料塾 出欠・LINEモック MVP（free-school-try5）

LINE アカウントがなくても、ブラウザだけで「保護者→塾」の出欠連絡とメッセージ送信を試せる MVP です。スタッフはダッシュボードで出欠一覧・統計・メッセージを確認できます。

## できること

- 保護者の登録（`/liff` で簡易プロフィールを作成してブラウザに保存）
- 児童の登録と保護者への紐付け
- 出欠連絡の送信（児童 × 日付で upsert）
- メッセージ送受信（inbound/outbound）
- スタッフ向けダッシュボード（出欠・統計・メッセージ）
- LINE モック UI（実LINEなしで送受信を擬似体験）

## 画面（ルート）

- `/`：概要ページ
- `/liff`：保護者向け LIFF 風フォーム（出欠・メッセージ）
- `/dashboard`：スタッフ向けダッシュボード
- `/mock-line`：LINE モック（メッセージ送受信のテスト用）

## API（Route Handlers）

- `GET /api/guardians` / `POST /api/guardians`
- `GET /api/students` / `POST /api/students`（`GET` は `?guardianId=` で絞り込み可）
- `GET /api/attendance` / `POST /api/attendance`（`GET` は `date` または `from/to` を指定）
- `GET /api/attendance/stats`（`date` または `from/to` を指定）
- `GET /api/messages` / `POST /api/messages`（`GET` は `guardianId` / `studentId` / `direction` で絞り込み可）

## 技術スタック

- Next.js（App Router）/ React / TypeScript
- Tailwind CSS
- Supabase（PostgreSQL）※ローカル開発は Supabase CLI + Docker
- Zod（入力バリデーション）
- Vitest（ユニットテスト）
- LINE Messaging API（デモ用 webhook 連携）

## セットアップ

前提:

- Node.js 20 推奨（`.devcontainer/devcontainer.json` 準拠）
- Docker（Supabase ローカル起動用）

環境変数:

- `cp .env.local.example .env.local`
- `npx supabase start` 後に `npx supabase status` を参照し、`.env.local` をローカルの値に置き換えます
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DEMO_BASIC_USER` / `DEMO_BASIC_PASS`（デモ用Basic認証。未設定なら無効）
  - `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`（LINE公式アカウント連携用）
  - `APP_BASE_URL`（任意: 返信文言で使うURL）

ローカル起動:

```bash
npm ci
npx supabase start
npm run dev
```

- Web: `http://localhost:3000`
- Supabase API: `http://localhost:54321`
- Supabase Studio: `http://localhost:54323`

## データモデル（Supabase）

`supabase/migrations/20260107013000_initial_schema.sql` に初期スキーマがあります。

- `guardians`（保護者）
- `students`（児童）
- `guardian_students`（紐付け）
- `attendance_requests`（出欠）
- `messages`（メッセージ）

## デプロイと運用（デモ想定）

- ホスティング: Vercel（Next.js）、DB: Supabase Cloud（Projectを作成しマイグレーション適用）
- Vercel 環境変数（Project Settings）
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  - `DEMO_BASIC_USER` / `DEMO_BASIC_PASS`（設定すると Basic 認証が有効。未設定なら無効）
  - `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`
  - `APP_BASE_URL`（例: https://your-demo.vercel.app）
- Basic 認証: middleware が `/api/line/webhook` を除く全リクエストに適用。ブラウザ/HTTPクライアントは Basic 認証を通さないと利用できない。
- Supabase マイグレーション: `npx supabase db push --project-ref <project-ref>` でクラウドへ適用。Production 反映前にステージングで確認する。

## LINE 公式アカウント連携（Webhook）

- LINE Developers の Messaging API チャネルを作成し、チャネルシークレット/アクセストークンを環境変数に設定。
- Webhook URL: `https://<デモドメイン>/api/line/webhook` を有効化。署名（`x-line-signature`）を検証。シークレット未設定時は警告ログのみでスキップ。
- 処理内容:
  - メッセージイベント（text）のみ処理。`source.userId` で guardian を照合、未登録なら `guardians` に作成（line_user_id を保存）。
  - メッセージ本文は `messages.direction = inbound` で保存。
  - 書式 `出欠 <出席|欠席|遅刻|未定> <YYYY-MM-DD> <児童名> [理由]` なら attendance を upsert（児童がなければ作成して guardian に紐付け）。
  - LINE へ返信メッセージを送信（アクセストークン設定時）。

## 開発用コマンド

- `npm run dev`：開発サーバ
- `npm run build`：ビルド
- `npm run start`：本番起動（ビルド後）
- `npm run lint`：Lint
- `npm test`：Vitest

## CI/CD

- GitHub Actions（`.github/workflows/ci.yml`）で `npm ci` → `npm run lint` → `npm test` → `npm run build` を実行。
- Vercel 連携で PR Preview / main → Production を自動デプロイ。環境変数は Vercel 側で管理する。

## セキュリティ注意

サーバ側（`src/app/api/**`）は `SUPABASE_SERVICE_ROLE_KEY` を利用します。ブラウザで扱う `NEXT_PUBLIC_*` と混同しないでください（公開リポジトリにキーをコミットしない）。

## ディレクトリ構成

- `src/app`：画面（`page.tsx`）と API（`api/**/route.ts`）
- `src/lib`：API クライアント、入力バリデーション、Supabase クライアントなど
- `supabase`：ローカル Supabase 設定、migrations、seed

## Dev Container（推奨）

`.devcontainer/devcontainer.json` を同梱しています。VS Code の Dev Containers で開くと Node.js と Docker（Supabase 用）が揃い、`3000` / `54321-54323` が自動でフォワードされます。

## ライセンス

未設定です。

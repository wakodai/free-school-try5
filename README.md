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

## 開発用コマンド

- `npm run dev`：開発サーバ
- `npm run build`：ビルド
- `npm run start`：本番起動（ビルド後）
- `npm run lint`：Lint
- `npm test`：Vitest

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

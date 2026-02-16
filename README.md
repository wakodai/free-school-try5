# 無料塾 出欠・連絡管理システム（free-school-try5）

LINE 公式アカウント連携による「無料塾向けの出欠・連絡管理システム」です。保護者は LINE から出欠連絡やメッセージを送信でき、スタッフはダッシュボードで出欠一覧・統計・メッセージを確認できます。

## できること

- 保護者の登録（LINE 経由）
- 児童の登録と保護者への紐付け
- 出欠連絡の送信（児童 × 日付で upsert）
- 保護者/スタッフ間のメッセージ送受信（inbound/outbound）
- スタッフ向けダッシュボード（出欠一覧・統計・メッセージ・管理）
- 保護者・児童の一覧管理と児童の削除（退会処理）
- LINE Messaging API の Webhook 連携（リッチメニューから出欠・状況確認・設定）

## 画面とルート

- `/dashboard`：スタッフ向けダッシュボード（出欠管理・メッセージ・統計・管理）
- `/api/line/webhook`：LINE Webhook エンドポイント

## API（Route Handlers）

- `GET /api/guardians` / `POST /api/guardians`
- `DELETE /api/guardians/[id]`
  - 保護者の削除（紐づく児童も全て削除される）
- `GET /api/students` / `POST /api/students`
  - `GET` は `?guardianId=` で絞り込み、`?withGuardian=true` で保護者情報付き取得
- `DELETE /api/students/[id]`
  - 児童の削除（出欠記録は CASCADE 削除、メッセージの student_id は NULL に設定）
- `GET /api/attendance` / `POST /api/attendance`
  - `GET` は `date` または `from/to` を指定
- `GET /api/attendance/stats`
  - `date` または `from/to` を指定
- `GET /api/messages` / `POST /api/messages`
  - `GET` は `guardianId` / `studentId` / `direction` で絞り込み可能
- `POST /api/line/webhook`
  - LINE 公式アカウントからのイベントを受け取り、会話フローを進行

## 技術スタック

- Next.js 16（App Router）/ React 19 / TypeScript
- Tailwind CSS 4
- Supabase（PostgreSQL）
- Zod（入力バリデーション）
- Vitest（ユニットテスト）
- LINE Messaging API（Webhook 連携）

## セットアップ

### 前提

- Node.js 20
- Docker（Supabase ローカル起動用）

### 1. 環境変数の準備

```bash
cp .env.local.example .env.local
```

`npx supabase status -o json` の出力を参照して、`.env.local` をローカル Supabase の値で置き換えます。

必須項目:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

任意（設定すると有効）:

- `DEMO_BASIC_USER` / `DEMO_BASIC_PASS`（Basic 認証）
- `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`（LINE 公式アカウント）
- `LINE_LESSON_WEEKDAYS`（授業曜日の候補）
- `APP_BASE_URL`（返信文言などに使う公開 URL）

### 2. Supabase を起動

```bash
npx supabase start
npx supabase migration up
```

### 3. アプリを起動

```bash
npm ci
npm run dev
```

- Web: `http://localhost:3000`
- Supabase API: `http://localhost:54321`
- Supabase Studio: `http://localhost:54323`

### 4. Seed（任意）

`supabase/seed.sql` にサンプルデータがあるので、必要に応じて Supabase に流し込んでください。

## データモデル（Supabase）

マイグレーションは `supabase/migrations` にあります。

- `guardians`（保護者）
- `students`（児童）
- `guardian_students`（紐付け）
- `attendance_requests`（出欠）
- `messages`（メッセージ）
- `line_flow_sessions`（LINE 会話の状態）

## LINE 公式アカウント連携（Webhook）

LINE Messaging API の Webhook を `/api/line/webhook` に設定すると、リッチメニューから以下のフローを利用できます。

- 未登録時: 保護者名 → 子ども名 → 学年 → 兄弟追加 → 完了
- 出欠登録: 子ども選択 → 日付 → 出欠 → コメント
- 登録状況確認: 子ども選択 → 期間指定 → 一覧返信
- 設定: 子ども追加/名前修正 → 元フローへ復帰

詳しい手順・リッチメニュー作成例は `docs/line-setup.md` を参照してください。

## Basic 認証

`DEMO_BASIC_USER` と `DEMO_BASIC_PASS` を設定すると、`/api/line/webhook` を除く全リクエストで Basic 認証が有効になります。

## 開発用コマンド

- `npm run dev`：開発サーバ
- `npm run build`：ビルド
- `npm run start`：本番起動（ビルド後）
- `npm run lint`：Lint
- `npm test`：テスト

## ディレクトリ構成

- `src/app`：画面 (`page.tsx`) と API (`api/**/route.ts`)
- `src/components`：UI コンポーネント
- `src/lib`：API クライアント、バリデーション、Supabase クライアント
- `supabase`：ローカル Supabase 設定、migrations、seed
- `docs`：運用ドキュメント

## Dev Container

`.devcontainer/devcontainer.json` を同梱しています。VS Code の Dev Containers で開くと Node.js 20 と Docker（Supabase 用）が揃い、`3000` / `54321-54323` がフォワードされます。

## ライセンス

未設定です。

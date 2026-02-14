# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 言語ルール

- Think in English, output in Japanese
- Pull Request は日本語で記述すること
- 複雑な機能や大規模リファクタリングは `.agent/PLANS.md` に定義された ExecPlan 形式で設計から実装まで進める

## 開発コマンド

```bash
npm run dev          # 開発サーバ起動 (http://localhost:3000)
npm run build        # プロダクションビルド
npm run lint         # ESLint 実行
npm test             # Vitest 実行
npx supabase start   # ローカル Supabase 起動
npx supabase migration up  # マイグレーション適用
```

CI（`.github/workflows/ci.yml`）は `npm run lint` → `npm test` → `npm run build` の順で実行される。

## プロジェクト概要

無料塾向けの出欠・連絡管理システム。保護者が LINE から出欠連絡を送信し、スタッフがダッシュボードで確認・返信する。

## アーキテクチャ

**技術スタック**: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS 4 / Supabase (PostgreSQL) / Zod 4 / LINE Messaging API

### レイヤー構成

- **`src/app/`** — Next.js App Router のページと API Route Handler
- **`src/lib/api.ts`** — フロントエンドから API を呼ぶ fetch ラッパー（型付き）
- **`src/lib/validators.ts`** — Zod スキーマで全 API 入力を検証（エラーメッセージは日本語）
- **`src/lib/http.ts`** — API Route 用の統一エラーレスポンス（`badRequestFromZod()` など）
- **`src/lib/supabase/`** — `client.ts`（ブラウザ用）と `server.ts`（サーバー用）の Supabase クライアント
- **`src/types.ts`** — ドメインモデル型定義（Guardian, Student, AttendanceRequest, Message）
- **`supabase/migrations/`** — DB スキーマ定義（PostgreSQL）

### 画面構成

| パス | 対象 | 説明 |
|------|------|------|
| `/dashboard` | スタッフ | 出欠一覧・統計・メッセージ管理 |

### LINE Webhook（最も複雑な部分）

`src/app/api/line/webhook/route.ts` に状態機械として実装。会話状態は `line_flow_sessions` テーブルに永続化される。

- **フロー**: registration（保護者登録）/ attendance（出欠）/ status（確認）/ settings（設定）
- **Postback データ**: コロン区切り（`flow:key:value`）で構造化
- **セッション有効期限**: 2日間

### DB テーブル

`guardians` → `guardian_students` ← `students` の多対多構造。`attendance_requests` は `(student_id, requested_for)` にユニーク制約で upsert。`messages` は保護者⇔スタッフの双方向。

### 認証

`src/middleware.ts` で Basic 認証（`DEMO_BASIC_USER`/`DEMO_BASIC_PASS` 設定時のみ有効）。`/api/line/webhook` は除外。

## コーディング規約

- API Route では必ず Zod でリクエストをパースし、`badRequestFromZod()` でエラー返却
- 日付は常に `YYYY-MM-DD` 文字列
- Supabase の snake_case カラムと TypeScript の camelCase プロパティのマッピングに注意
- 環境変数は `src/lib/env.ts` のヘルパー経由で取得

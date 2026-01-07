# 無料塾向けLINE/LIFF出欠管理MVPの実装計画 (ExecPlan)

この ExecPlan は生きた文書。.agent/PLANS.md の要件に従い、進捗・発見・判断・結果を随時更新する。リポジトリとこのファイルだけで初心者がゴールに到達できるよう自己完結させる。

## Purpose / Big Picture

保護者が塾公式LINEのLIFFから児童ごとの出欠を日付指定で申請し、スタッフがSPAダッシュボードで出欠予定・統計・メッセージを確認／返信できるようにする。ローカル環境で全機能（LINE受信が不可ならLINEモックを含む）が動作し、将来的にVercel + Supabaseへ容易にデプロイできる構成を用意する。運用コストは極小（無料枠前提）を狙う。

## Progress

- [x] (2026-01-07 00:59Z) ExecPlan 初版作成（要件反映・設計方針まとめ）
- [x] (2026-01-07 01:27Z) Next.js プロジェクト初期化（App Router/TypeScript/Tailwind/ESLint scaffolding）
- [x] (2026-01-07 01:32Z) `.env.local.example` 作成と環境変数テンプレート準備
- [x] (2026-01-07 01:33Z) データモデルと初期マイグレーションSQL追加
- [x] (2026-01-07 01:54Z) Supabase ローカル起動確認・キー取得・`.env.local` 作成・マイグレーション適用
- [x] (2026-01-07 02:16Z) 出欠/メッセージ/ガーディアン/児童 API 実装とバリデーション単体テスト
- [x] (2026-01-07 02:54Z) LIFF/LINE風出欠フォーム実装（保護者登録・児童追加・日付/出欠選択・LINEモック送信）
- [x] (2026-01-07 02:55Z) ダッシュボードSPA実装（一覧・統計・メッセージ閲覧/返信・LINEモックリンク）
- [ ] E2E的動作確認（ローカル実行＋LINEモック経由）
- [ ] 成果・残課題のレトロスペクティブ記載

## Surprises & Discoveries

- Observation: リポジトリ直下が空でなかったため `npx create-next-app .` が衝突検出で失敗。  
  Evidence: CLI のメッセージ「The directory free-school-try5 contains files that could conflict」。
- Observation: `npx create-next-app tmp-app ...` 実行時に依存インストール途中でタイムアウトしたが、scaffold は生成されていた。  
  Evidence: `tmp-app/` に Next.js 初期ファイルが生成されており、その後ルートへ rsync して `npm install` を完了。
- Observation: `npx supabase start` は初回に長時間Pullでタイムアウトしたが、バックグラウンドでコンテナは起動しており、再実行で「already running」と表示。  
  Evidence: `docker ps` で supabase_* コンテナが稼働、`supabase status -o json` でキーとURLを取得できた。
- Observation: `.gitignore` の `.env*` パターンで `.env.local.example` も無視されていたため、例示ファイルをトラッキングできなかった。  
  Evidence: ルート `.gitignore` を `!.env.local.example` 追加で修正し、テンプレートを新規作成。
- Observation: 出欠統計APIが未実装だったため、サーバーサイドで日付範囲の集計を行う`GET /api/attendance/stats`を追加した。  
  Evidence: `src/app/api/attendance/stats/route.ts` を新設し、present/absent/late/unknown の件数を返却。

## Decision Log

- Decision: Next.js 14 App Router + TypeScript を採用し、API Routes でサーバレス想定のエンドポイントを提供する。  
  Rationale: Vercel デプロイを前提にした構成であり、App RouterはServer ComponentsとRoute HandlersによりUI/ APIを統合しやすい。  
  Date/Author: 2026-01-07 / assistant
- Decision: DBはSupabase(PostgreSQL)を使用し、ローカルはSupabase CLIの`supabase start`でDocker起動する。  
  Rationale: 将来クラウドSupabaseへ移行しやすく、無料枠で要件を満たす。  
  Date/Author: 2026-01-07 / assistant
- Decision: LINEが使えない環境に備え、ダッシュボードに「LINEモックUI」への小さなリンクボタンを常設し、保護者向けLIFF風フローをブラウザ内で再現する。  
  Rationale: 受け入れ条件でLINE未接続時にも全機能を確認できる必要があるため。  
  Date/Author: 2026-01-07 / assistant
- Decision: Supabaseローカルのキー取得は `npx supabase status -o json` を使い、CLIタイムアウト時もバックグラウンド起動を `docker ps` で確認してから再試行する。  
  Rationale: 初回イメージPullでCLIがタイムアウトしてもサービス自体は起動していたため、状態確認とキー抽出が安全。  
  Date/Author: 2026-01-07 / assistant
- Decision: `POST /api/attendance` は `(student_id, requested_for)` を onConflict で upsert し、同じ児童の同日出欠を上書き可能にする。  
  Rationale: 申請後の訂正を許容し、重複エラーで保護者・スタッフを詰まらせないようにする。  
  Date/Author: 2026-01-07 / assistant
- Decision: `GET /api/attendance` は日付または期間指定なしの全件取得を許可せず、`date` か `from/to` 指定を必須とする。  
  Rationale: データ件数が増えた際の無制限フェッチを避け、API利用意図を明確にする。  
  Date/Author: 2026-01-07 / assistant
- Decision: 出欠統計はビューではなくAPIルートで集計し、指定日/期間に対する present/absent/late/unknown と児童別の件数を返す。  
  Rationale: Next.js Route Handler 内で Supabase から必要データのみ取得し計算することで、View/RPCの追加なしに UI から参照できるため。  
  Date/Author: 2026-01-07 / assistant
- Decision: LIFF風フォームでは保護者プロフィールをローカルストレージに保存し、再訪時の入力を省略する。  
  Rationale: LINEログインなしのMVPで入力負荷を避け、家族単位で継続利用しやすくするため。  
  Date/Author: 2026-01-07 / assistant

## Outcomes & Retrospective

- 初版のため未記入（機能実装・確認後に成果と残課題をまとめる）

## Context and Orientation

- 現状リポジトリ: README のみ。これから Next.js + Supabase を導入する。
- 環境: devcontainer を使用し、Node 20 と Docker（Supabase CLI 用）を利用する。CODEX_HOME は `${containerWorkspaceFolder}/.codex` に設定する。
- 用語:  
  - LIFF: LINE Front-end Framework。ここではLINEミニアプリ風UIを指す。実機連携がない場合は「LINEモックUI」で代替。  
  - 保護者: 子どもの出欠を申請するユーザー。  
  - 児童: 塾に通う子ども。  
  - 出欠申請: 保護者が日付と児童ごとの出席/欠席/遅刻などを登録する行為。  
  - メッセージ: LINE DMを模したテキスト。方向は`inbound`(保護者→塾)と`outbound`(塾→保護者)で保存する。
- 想定スタック: Next.js 14 (App Router) / React / TypeScript / Supabase(PostgreSQL) / Tailwind (UI効率化) / Vitest or Jest（軽量単体テスト） / Playwrightは任意（軽いE2E）。
- 認証: 当面は簡易的（保護者名と子の紐付けをDBに保持）。将来LINEログインやパスコードによる認証を追加できるよう、guardianテーブルに`line_user_id`や`login_token`を予約する。

## Plan of Work

1. **ベース環境整備**  
   - devcontainer 構成を追加（Node 20, Docker-in-Docker, CODEX_HOME 設定）。プロジェクト直下に `.codex` ディレクトリを作成済みであることを確認し、Dev Container 内で参照。  
   - Next.js プロジェクトを `npm create next-app@latest`（App Router）で初期化し、`src`構成・TypeScript・ESLint/Tailwindを有効化する。  
   - `.env.local.example` を用意し、Supabase URL/anon key/service role key を記載する（ローカルでSupabase CLI起動後に取得）。  
2. **データモデル設計とマイグレーション作成**  
   - テーブル案（すべて `supabase/migrations` でSQL管理）:  
     - `guardians`: id (uuid), name, phone, line_user_id (nullable), login_token (nullable), created_at.  
     - `students`: id (uuid), name, grade (text), notes (text), created_at.  
     - `guardian_students`: guardian_id, student_id（多対多; 兄弟対応）。  
     - `attendance_requests`: id, guardian_id, requested_for (date), status (enum: present/absent/late/unknown), reason (text), created_at, student_id。  
     - `messages`: id, guardian_id, student_id (nullable), direction (inbound/outbound), body (text), created_at。  
   - 将来の認証拡張を考慮し、`line_user_id`や`login_token`はユニーク制約を検討。  
   - 集計用にビューまたはSQLクエリを用意し、日付・児童別の出席率を算出する。
3. **データアクセスとAPIルーティング**  
   - `src/lib/supabase/client.ts` にブラウザ用クライアント、`src/lib/supabase/server.ts` にservice roleキーを使うサーバ用クライアントを実装。  
   - Route Handlers（App Routerの`app/api/*/route.ts`）でRESTfulエンドポイントを提供:  
     - `POST /api/guardians` 保護者登録。  
     - `GET /api/students` / `POST /api/students` 児童一覧・登録。  
     - `POST /api/attendance` 出欠申請（保護者 UI から呼ぶ）。  
     - `GET /api/attendance?date=...` 指定日の一覧（スタッフ用）。  
     - `GET /api/attendance/stats` 児童別・全体の出席率集計。  
     - `GET/POST /api/messages` 受信・送信のログ取得/追加。  
   - 入力バリデーションを`zod`で行い、エラーレスポンスを統一する。
4. **UI構成**  
   - **保護者向け LIFF/LINE風UI** (`app/liff/page.tsx` 想定): 初回登録フォーム（保護者名/電話/任意の識別子）、児童追加、日付選択、児童選択、出欠選択(出席/欠席/遅刻/未定)、理由入力、送信確認。LINE未接続でもフォームが動作する。  
   - **LINEモックUI**: 同じ画面もしくは簡易サンドボックス（小ウィンドウ）でテキスト送受信をシミュレートし、`messages` テーブルに保存。  
   - **スタッフダッシュボードSPA** (`app/dashboard`):  
     - 今日・未来日付の出欠予定一覧（児童・ステータス・メモ）。  
     - 出席率/参加人数の集計カード（児童別・全体・日付フィルタ）。  
     - メッセージ受信一覧と返信フォーム（送信はアウトバウンドとして保存）。  
     - 画面の隅に「LINEモックを開く」小ボタンを表示し、別タブ/モーダルでモックUIへ遷移。  
   - UIはレスポンシブで、ダッシュボードはSPA的にクライアントフェッチ or Server Actionsでデータ取得。Tailwindで最小限のスタイル。
5. **テストと検証**  
   - 重要ロジック（バリデーション、集計クエリ、APIステータスコード）をVitest/Jestでカバー。  
   - 手動検証: Supabase 起動 → Next.js dev server → 保護者UIで登録/出欠送信 → ダッシュボードで反映/統計確認 → メッセージ送受信確認 → LINEモックからの送信が messages に記録されることを確認。  
   - 将来のVercelデプロイを想定し、環境変数は `.env.local` のみを参照、ハードコードを避ける。
6. **後片付けと記録**  
   - Progress/Decision Log/Surprises を更新し、Acceptanceに沿った証跡（スクリーンショットの説明やログ抜粋）を Artifacts に整理。  
   - 失敗時のリカバリ手順（DB初期化等）を Idempotence に追記。

## Concrete Steps

1. （リポジトリ直下）devcontainer で再オープンし、Node 20 と Docker が使えることを確認。  
2. Next.js 初期化:  
       npm create next-app@latest . \  
         --typescript --tailwind --eslint --src-dir --app --no-import-alias  
   既存ファイルと衝突する場合は手動で配置。  
3. Supabase CLI インストール（開発用）:  
       npm install --save-dev supabase  
   もしくはbrew/バイナリ。  
4. Supabase 起動:  
       npx supabase start  
   Pullで時間がかかる場合は待機し、タイムアウトしても `docker ps` でコンテナ稼働を確認。キーは  
       npx supabase status -o json  
   の出力から `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` を `.env.local` に反映。  
5. マイグレーション作成と適用: `supabase/migrations/<timestamp>_init.sql` にテーブル定義を記述し、  
       npx supabase migration up  
   で適用・確認。  
6. Supabase クライアントユーティリティと API Routes を実装し、`npm run lint` / `npm test` を通す。  
7. UI 実装（保護者/LINEモック/ダッシュボード）を進め、`npm run dev` で http://localhost:3000 にて手動検証。  
8. Acceptance に沿って手順を実行し、結果を Outcomes と Artifacts に記録。

## Validation and Acceptance

受け入れ条件（ローカルで再現可能なこと）:
- `npx supabase start` でDBとAPIが立ち上がり、`npm run dev` でNext.jsが起動する。  
- 保護者UI（LIFF風）から: 初回登録 → 児童追加 → 日付/児童/出欠/理由を選択して送信。送信後はDBの `attendance_requests` にレコードが生成される。  
- ダッシュボードで: 指定日の出欠一覧が表示され、集計カードで児童別/全体の出席率・人数が確認できる。  
- メッセージ: LINEモックUIから送信すると `messages` に `inbound` が保存され、ダッシュボードで閲覧できる。ダッシュボードから返信すると `outbound` が保存され、モックUIに反映される。  
- 上記フローがリロード後も保持され、操作がエラーなく完了する。将来のクラウド移行を阻害するハードコードがない。

## Idempotence and Recovery

- Supabaseデータは `npx supabase db reset` で初期化できる。マイグレーションは繰り返し適用可能な形で作成する。  
- `.env.local` を変更しない限り、`npm run dev` の再起動だけでUIを再検証できる。  
- 破壊的変更が必要な場合はバックアップ（`npx supabase db dump`）を取得してから実施。

## Artifacts and Notes

- (2026-01-07 02:16Z) `npm test` (vitest) 通過。対象: `src/lib/validators.test.ts`（入力バリデーションのフォーマット検証）。
- (2026-01-07 02:55Z) `npm run lint` / `npm test` をUI実装後に再実行し、いずれも成功。

## Interfaces and Dependencies

- 主要型（TypeScript想定 `src/types.ts`）:  
  - `Guardian { id: string; name: string; phone?: string; lineUserId?: string | null; loginToken?: string | null; createdAt: string; }`  
  - `Student { id: string; name: string; grade?: string | null; notes?: string | null; createdAt: string; }`  
  - `AttendanceRequest { id: string; guardianId: string; studentId: string; requestedFor: string; status: 'present' | 'absent' | 'late' | 'unknown'; reason?: string | null; createdAt: string; }`  
  - `Message { id: string; guardianId: string; studentId?: string | null; direction: 'inbound' | 'outbound'; body: string; createdAt: string; }`
- API 期待リクエスト例:  
  - `POST /api/guardians` body `{ name, phone?, lineUserId?, loginToken? }` -> `{ id, name }`  
  - `POST /api/attendance` body `{ guardianId, studentId, requestedFor (YYYY-MM-DD), status, reason? }` -> `{ id }`  
  - `GET /api/attendance/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` -> `{ byStudent: [{ studentId, present, total }], overall: { present, total } }`  
  - `POST /api/messages` body `{ guardianId, studentId?, direction, body }` -> `{ id }`
- 依存ライブラリ: `next`, `react`, `@supabase/supabase-js`, `zod`, `tailwindcss`, `@supabase/ssr` (必要なら), `vitest` or `jest`.

# LINEリッチメニューと会話フロー拡張 ExecPlan

この ExecPlan は生きた文書。.agent/PLANS.md の要件に従い、進捗・発見・判断・結果を随時更新する。リポジトリとこのファイルだけで初心者がゴールに到達できるよう自己完結させる。

## Purpose / Big Picture

LINE公式アカウントのリッチメニュー（出欠登録 / 登録状況確認 / 設定）を起点に、初回登録・出欠登録・状況確認の会話フローをWebhookで自動返信できるようにする。Quick Reply・ボタン・Datetime picker を使って保護者が子ども・日付・出欠を選び、既存のSupabaseスキーマ（guardians/students/attendance_requests/messages）へ保存する。ダッシュボード・LIFF風UIと同じデータを共有し、スタッフ側で状況が確認できる。

## Progress

- [x] (2026-01-07 16:20Z) ExecPlan 初版作成（要件読み込み・方針整理）
- [x] (2026-01-07 16:25Z) LINE会話フローの状態機械・授業日候補ロジック設計（weekday環境変数で制御）
- [x] (2026-01-07 16:26Z) Supabaseマイグレーションと型更新（line_flow_sessions追加）
- [x] (2026-01-07 16:29Z) Webhookロジック実装（リッチメニューpostback/quick reply/datetime picker対応）、LINEセットアップドキュメント追加、lint/test実行

## Surprises & Discoveries

- 記載なし（進めながら追加する）

## Decision Log

- Decision: 授業日候補は環境変数で曜日配列を受け取り、未指定時は毎週土曜の次回以降3回を提示する。  
  Rationale: 直近の授業日ボタン要件を満たしつつ教室ごとの開催曜日に合わせて調整可能にする。  
  Date/Author: 2026-01-07 / assistant
- Decision: LINE会話の進行状態は `line_flow_sessions` に `flow/step/data` と guardian_id を保持し、子ども未登録時は設定フローへ遷移・完了後に元のフローへ戻る `resumeFlow` を持たせる。  
  Rationale: entry postbackからの多段フローを中断・再開でき、兄弟追加などの分岐後に元の目的（出欠登録/状況確認）へ自動で復帰させるため。  
  Date/Author: 2026-01-07 / assistant

## Outcomes & Retrospective

完了時に成果・残課題を記載する。

## Context and Orientation

- 既存スキーマ: guardians（line_user_idあり）、students、attendance_requests、messages。LINE Webhookは `/api/line/webhook` にあり、テキストコマンドで出欠登録をしている。
- 追加要件: リッチメニュー3ボタン（postback+displayText）、初回登録を強制する会話フロー、出欠登録フロー（子ども選択→日付→出欠→コメント）、登録状況確認フロー（子ども選択→期間選択→一覧返信）。
- 制約: App Router / Next.js 16 / Supabase Service Role でDB操作。Basic認証はWebhookパス除外済み。

## Plan of Work

1. LINE会話フロー設計  
   - 会話状態を「flow（registration/attendance/status/settings）」「step」「data」で管理する状態機械を設計。  
   - 受信イベント種別（postback/message/datetimepicker）と期待入力の対応表を作り、表示するQuick ReplyやFlexを定義。  
   - 初回登録未完ならいずれの入口でも registration flow に強制遷移し、完了後に元のフローへ戻る仕様を決める。
2. データ永続化の準備  
   - `line_flow_sessions`（line_user_id単位の現在のflow/step/data/guardian_id/有効期限）テーブルを追加するマイグレーションを作成。  
   - Supabase型定義（src/lib/supabase/types.ts）を更新。
3. Webhookロジック実装  
   - `/api/line/webhook` をリッチメニューpostback/quick reply/datetimepicker対応に刷新。  
   - state永続化を使って multi-turn を処理（名前入力→子ども追加→再誘導、出欠の子ども/日付/ステータス/コメント入力、状況確認の期間指定）。  
   - 返信メッセージで displayText を設定し、Quick Replyのボタン・Datetime picker・Flex（子ども一覧や結果一覧）を構築。  
   - attendance_requests/messages/students/guardians へ保存し、ダッシュボードに即反映されるようにする。
4. ドキュメントとサンプル  
   - `.env.local.example` にLINE設定・授業曜日設定を追記。  
   - LINE公式アカウントの作成手順とリッチメニュー/チャネル設定手順を docs にまとめる。  
   - Webhook擬似POSTの例を残し、ローカルで検証できるようにする。
5. 検証  
   - `npm test` / `npm run lint`。  
   - ローカルでWebhookに擬似イベント（登録フロー / 出欠登録 / 状況確認）をPOSTし、Supabaseに登録されダッシュボードで見えることを確認。

## Concrete Steps

1. 設計メモをこのファイルに追記しつつ状態遷移とデータ構造を決定する。  
2. マイグレーション追加: `supabase/migrations/<timestamp>_line_flow_sessions.sql` にテーブル定義を記述し、`src/lib/supabase/types.ts` を更新。  
3. Webhook更新: `src/app/api/line/webhook/route.ts` をリファクタして会話状態管理・返信生成を実装。  
4. 環境変数サンプル/ドキュメント追加: `.env.local.example` と新規ドキュメント（例: `docs/line-setup.md`）に設定手順を記載。  
5. 動作確認: `npm test` / `npm run lint`、さらに `curl localhost:3000/api/line/webhook` へサンプルイベントをPOSTして登録・出欠・確認フローが動くことを手動確認。

## Validation and Acceptance

- リッチメニューのpostbackデータ（出欠登録/登録状況確認/設定）がWebhookで受け取られると、未登録ユーザーは登録フローに誘導され、登録済ユーザーは該当フローが開始する。  
- 登録フローで保護者名→子ども名→学年選択（Quick Reply）→兄弟追加可否が行え、完了後に children がDBに保存される。  
- 出欠登録フローで子ども選択（Quick Reply/Flex）→日付選択（授業日候補ボタン+datetime picker）→ステータスボタン→コメント入力が行え、attendance_requests と messages に反映される。  
- 登録状況確認フローで子ども選択と期間選択（次回〜3回/今月/日付指定）ができ、指定期間の出欠状況が一覧表示される。  
- `.env.local.example` とドキュメントにLINE公式アカウント作成～リッチメニュー登録～Webhook URL設定手順が記載されている。  
- `npm run lint` と `npm test` が成功する。

## Idempotence and Recovery

- line_flow_sessions は line_user_id 主キーで上書き保存し、フロー途中でも再開可能。expiredなら初期化して再開。  
- マイグレーションは追加のみ。失敗時は `npx supabase db reset` で再適用。  
- Webhookテストは同じサンプルイベントを複数回POSTしてもupsertで整合性が保たれる（attendance_requests は student_id+date でユニーク）。

## Artifacts and Notes

- サンプルWebhookイベントJSON（登録/出欠/状況確認）は docs に記載予定。  
- 授業曜日は環境変数で変更可能にする（例: `LINE_LESSON_WEEKDAYS=6` で土曜）。
- (2026-01-07 16:28Z) `npm test` / `npm run lint` 成功（LINEフロー実装後の検証）。

## Interfaces and Dependencies

- 新テーブル: `line_flow_sessions(line_user_id text PK, guardian_id uuid?, flow text, step text, data jsonb, expires_at timestamptz, created_at/updated_at)`。  
- 新環境変数想定: `LINE_LESSON_WEEKDAYS`（例: `1,3,6`）、`LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `APP_BASE_URL`。  
- LINE Messaging API reply payloadで使用する型: Quick Reply（postback/datetimepicker）、Flex Message（子ども一覧・出欠結果）。  
- 主要関数（予定）: `startRegistrationFlow`, `startAttendanceFlow`, `startStatusFlow`, `handlePostbackEvent`, `handleMessageEvent`, `persistSession`, `getUpcomingLessonDates`.

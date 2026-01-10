# LINE登録フローの名前入力ループを解消する


この ExecPlan は生きた文書。Progress / Surprises & Discoveries / Decision Log / Outcomes & Retrospective を随時更新し、`.agent/PLANS.md` の要件に従う。


## Purpose / Big Picture


新規の保護者が LINE 公式アカウントで登録を開始した際、名前を入力しても次のステップに進めず同じプロンプトが繰り返される不具合を解消し、正しく児童登録まで案内できるようにする。


## Progress


- [x] (2026-01-10 04:40Z) 不具合の原因を特定し、修正方針を立案
- [x] (2026-01-10 04:48Z) route.ts の登録フロー分岐を修正して guardian 未作成時でも入力を処理できるようにする
- [x] (2026-01-10 05:29Z) lint/test/build で正常終了することを確認（Next.js build 警告のみ）


## Surprises & Discoveries


- Observation: registration フローを通すためのガード変更後、TypeScript が attendance/status ブロックで guardian が null かもしれないと判定し build が失敗した
  Evidence: `npm run build` で `route.ts:1945` guardian 引数が null 非許容と報告
  Action: registration ブロックを先に処理し、その後で guardian 非存在時は startRegistrationFlow に戻す形にロジックを並べ替え、再ビルドを通過


## Decision Log


- Decision: guardian 未存在時のメッセージ受信で `startRegistrationFlow` に即リターンさせず、既存セッションの registration フロー処理に進める条件へ変更する
  Rationale: 名前入力後も guardian がまだ存在しないため従来の早期リターンで処理がリセットされ、ループが発生していた
  Date/Author: 2026-01-10 / Codex


## Outcomes & Retrospective


（完了後に記載）


## Context and Orientation


- 対象ファイル: `src/app/api/line/webhook/route.ts`
- 現状: `routeMessage` と `routePostback` で guardian が存在しない場合に常に `startRegistrationFlow` を呼んで return するため、registration フローの途中で guardian が未作成の状態だと入力処理に到達しない
- 期待: registration セッション中は guardian がなくても `handleRegistrationText` などが呼ばれ、名前入力後に guardian レコードが生成されて次のステップに進む


## Plan of Work


1. `route.ts` の `routeMessage` と必要なら `routePostback` の guardian チェックを、registration フロー時は早期リターンせずハンドラに委譲する条件へ書き換える。
2. ロジックを読み直し、副作用（settings/attendance/status）に影響しないか確認する。
3. 手動確認手順をまとめ、必要ならシミュレーションや軽微なテストコマンドを準備する。


## Concrete Steps


- 作業ディレクトリ: `/workspaces/free-school-try5`
- 既存ロジック確認: `sed -n '1880,1960p' src/app/api/line/webhook/route.ts`
- 実装: `route.ts` を編集（guardian チェックと registration 分岐の条件変更）
- 差分確認: `git diff src/app/api/line/webhook/route.ts`


## Validation and Acceptance


- シナリオ: 新規ユーザーがフォロー → registration セッション開始 → 保護者名を送信すると `guardians` に作成され、次の「お子さんの名前を入力してください」メッセージが返ることを確認する。
- 既存ユーザー: guardian が存在する場合は従来どおりメインメニュー案内や各フローに入れることを確認する。


## Idempotence and Recovery


- 変更は条件分岐のみで idempotent。問題があれば `git checkout -- src/app/api/line/webhook/route.ts` で復旧可能。


## Artifacts and Notes


- 関連関数: `routeMessage`, `routePostback`, `handleRegistrationText`, `startRegistrationFlow`


## Interfaces and Dependencies


- 外部サービス: LINE Messaging API, Supabase (`getSupabaseServerClient` 経由)
- 変更は API インターフェースを変えず、内部の分岐条件のみ調整する

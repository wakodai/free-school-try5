# LINE公式アカウント設定ガイド（出欠登録フロー対応）

このドキュメントは、本リポジトリのWebhook `/api/line/webhook` をLINE公式アカウントと連携し、リッチメニュー → Webhook → 返信メッセージ（クイックリプライ / ボタン / Datetime picker）の流れで出欠管理を行うための手順をまとめる。

## 環境変数

- `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`  
  LINE Messaging APIチャネルのチャネルシークレット／長期チャネルアクセストークン。
- `APP_BASE_URL`  
  Webhookの外部公開URL（例: `https://your-app.vercel.app`）。ローカルでngrok等を使う場合はそのURL。
- `LINE_LESSON_WEEKDAYS`  
  授業日の曜日リスト（0=日〜6=土をカンマ区切り）。直近授業日のボタンや「次回〜3回」などの候補に使う。未設定時は土曜のみ。

`.env.local.example` にサンプルがあるので、`.env.local` にコピーして値を設定する。

## 想定する会話フロー（保護者側）

- **初回登録**: 保護者名入力 → 子ども名入力 → 学年選択（Quick Reply） → 兄弟追加の有無 → 完了後にメニュー案内。  
  登録未済でどのボタンを押しても、このフローに強制遷移。
- **出欠登録**: 子ども選択（Quick Reply/Flex） → 日付選択（直近授業日ボタン + Datetime picker） → 出欠ボタン → コメント（任意） → 完了通知。  
  `attendance_requests` と `messages` に保存され、ダッシュボードに即反映。
- **登録状況確認**: 子ども選択 → 期間選択（次回〜3回 / 今月 / 日付指定） → 登録状況一覧を返信。
- **設定**: 子ども追加・名前修正用。完了後に出欠/確認フローへ戻ることができる。

## LINE公式アカウントの作成とWebhook設定

1. [LINE Developers](https://developers.line.biz/console/) にログインし、プロバイダーを作成。
2. 「Messaging API」チャネルを新規作成。  
   - チャネル基本設定でチャネルシークレットを控える。  
   - Messaging API設定で「長期チャネルアクセストークン」を発行して控える。
3. Webhook設定  
   - Webhook URLに `https://<APP_BASE_URL>/api/line/webhook` を設定し、「接続確認」を成功させる。  
   - 応答メッセージは任意（Botに任せるならOFF推奨）。  
   - Webhook送信を「利用する」にする。
4. `.env.local` に `LINE_CHANNEL_SECRET` と `LINE_CHANNEL_ACCESS_TOKEN` をセットし、アプリをデプロイ／起動する。

## リッチメニュー（3ボタン、すべてpostback）

- サイズ: `2500 x 843`（デフォルト）  
- アクション: 3分割し、それぞれpostback + displayTextを設定。
  - 出欠登録: `data: "entry:attendance"`, `displayText: "出欠登録"`
  - 登録状況確認: `data: "entry:status"`, `displayText: "登録状況確認"`
  - 設定: `data: "entry:settings"`, `displayText: "設定"`

リッチメニュー作成の例（JSON指定）:

```bash
# リッチメニュー作成
curl -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "size": { "width": 2500, "height": 843 },
    "selected": true,
    "name": "attendance-menu",
    "chatBarText": "メニュー",
    "areas": [
      { "bounds": { "x": 0, "y": 0, "width": 833, "height": 843 }, "action": { "type": "postback", "data": "entry:attendance", "displayText": "出欠登録" } },
      { "bounds": { "x": 833, "y": 0, "width": 834, "height": 843 }, "action": { "type": "postback", "data": "entry:status", "displayText": "登録状況確認" } },
      { "bounds": { "x": 1667, "y": 0, "width": 833, "height": 843 }, "action": { "type": "postback", "data": "entry:settings", "displayText": "設定" } }
    ]
  }'

# 返ってきた richMenuId をアカウントにリンク
curl -X POST "https://api.line.me/v2/bot/user/all/richmenu/<richMenuId>" \
  -H "Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}"
```

※ 背景画像を設定する場合は `PUT /v2/bot/richmenu/{richMenuId}/content` に画像をアップロードする。

## ローカルでの動作確認

1. Supabaseを起動し、マイグレーションを適用する（必要なら `npx supabase start` → `npx supabase migration up`）。  
2. `npm run dev` でアプリを起動。  
3. Webhookを外部に公開する場合は ngrok などで `https://<tunnel>/api/line/webhook` を公開し、LINE Developers のWebhook URLを差し替える。  
4. 手元で擬似イベントを投げる例（LINEリプライは行われないがサーバーロジックを通せる）:

```bash
# 出欠登録フロー開始（entry:attendance）
curl -X POST http://localhost:3000/api/line/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "type": "postback",
      "replyToken": "dummy",
      "source": { "userId": "U1234567890", "type": "user" },
      "postback": { "data": "entry:attendance" }
    }]
  }'
```

LINE経由での検証では、リッチメニューをタップ → Botの質問に従ってボタン/カレンダー/テキストで回答する。ダッシュボード `/dashboard` に即時反映される。

## 参考：曜日候補の調整

`LINE_LESSON_WEEKDAYS` で授業曜日を指定すると、出欠フローの「直近の授業日ボタン」および状況確認フローの「次回〜3回」「今月」の候補生成に使われる。  
例: 火・土開催なら `LINE_LESSON_WEEKDAYS=2,6`。

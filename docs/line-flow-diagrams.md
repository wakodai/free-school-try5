# LINE会話フロー図（Mermaid）

このドキュメントは `src/app/api/line/webhook/route.ts` の実装に基づき、
LINE公式アカウント経由の会話フローを図示したものです。

## 1. Webhook全体の流れ

```mermaid
flowchart TD
  A[LINE Webhook受信 POST] --> B{署名検証}
  B -->|OK| C[events配列を順に処理]
  C --> D{event.source.userId?}
  D -->|no| C
  D -->|yes| E[guardian取得 (line_user_id)]
  E --> F[session取得 (line_flow_sessions)]
  F --> G[handleFollowEvent]
  F --> H[routePostback]
  F --> I[routeMessage]
```

## 2. Followイベント

```mermaid
flowchart TD
  A[followイベント] --> B{guardian存在?}
  B -->|no| C[登録フロー開始]
  B -->|yes| D[セッションをidleにリセット]
  D --> E[リッチメニュー誘導メッセージ返信]
```

## 3. Postback（リッチメニュー/クイックリプライ）

```mermaid
flowchart TD
  A[postbackイベント] --> B[postback解析]
  B --> C{flow == entry?}
  C -->|yes & guardian未登録| D[登録フロー開始]
  C -->|yes & attendance| E[出欠登録フロー開始]
  C -->|yes & status| F[登録状況確認フロー開始]
  C -->|yes & settings| G[設定フロー開始]

  C -->|no| H{guardian未登録?}
  H -->|yes & currentSession.flow!=registration| D
  H -->|no| I{currentSessionある?}
  I -->|no| J[何もしない]

  I -->|yes & flow==registration| K[登録フロー継続]
  I -->|yes & flow==settings| L[設定フロー継続/開始]
  I -->|yes & flow==attendance| M[出欠登録フロー継続]
  I -->|yes & flow==status| N[登録状況確認フロー継続]
```

## 4. Message（テキストメッセージ）

```mermaid
flowchart TD
  A[textメッセージ] --> B{guardian存在?}
  B -->|yes| C[メッセージ保存]
  B --> D{session.flow == registration?}
  D -->|yes| E[登録フロー継続]
  D -->|no & guardian未登録| F[登録フロー開始]
  D -->|no & sessionなし or idle| G[リッチメニュー案内返信]
  D -->|no & flow==settings| H[設定フロー継続]
  D -->|no & flow==attendance| I[出欠登録フロー継続]
  D -->|no & flow==status| J[登録状況確認フロー継続]
```

## 5. セッション保持（line_flow_sessions）

```mermaid
flowchart TD
  A[loadSession] --> B{expires_at期限切れ?}
  B -->|yes| C[レコード削除->null]
  B -->|no| D[flow/step/data/guardianIdを復元]

  E[persistSession] --> F[upsert line_flow_sessions]
  F --> G[expires_atを48h後に更新]

  H[resetSession] --> I[flow=idle/step=idleで保存]
```

## 6. フロー種別（エントリ）

```mermaid
flowchart LR
  A[entry (リッチメニュー)] --> B[registration]
  A --> C[attendance]
  A --> D[status]
  A --> E[settings]
```

---

# フロー内部ステップ詳細

## A. registration（初期登録）

```mermaid
flowchart TD
  A[開始: startRegistrationFlow] --> B[ask_guardian_name]
  B -->|名前入力OK| C[guardian作成/更新]
  C --> D[ask_child_name]
  B -->|空入力| B1[再入力要求]

  D -->|名前入力OK| E[ask_child_grade]
  D -->|空入力| D1[再入力要求]

  E -->|grade選択/入力| F[児童作成]
  F --> G[ask_more_children]

  G -->|追加する| D
  G -->|これで完了| H[finishRegistration]
  H --> I[セッションリセット]
  H --> J[メインメニュー案内]
  H --> K{resumeFlow?}
  K -->|attendance| L[出欠登録フローへ]
  K -->|status| M[登録状況確認フローへ]
```

## B. attendance（出欠登録）

```mermaid
flowchart TD
  A[開始: startAttendanceFlow] --> B{児童存在?}
  B -->|no| C[settingsへ遷移 (resume=attendance)]
  B -->|yes| D[choose_student]

  D -->|児童選択| E[choose_date]
  D -->|名前テキスト一致| E
  D -->|不一致| D1[再選択要求]

  E -->|日付選択/入力| F[choose_status]
  E -->|日付不正| E1[再選択要求]
  E -->|児童ID欠落| E2[セッションリセット→児童選択へ]

  F -->|出欠選択| G[ask_comment]
  F -->|不正値| F1[再選択要求]

  G -->|コメント入力/なし| H[finalizeAttendance]
  H --> I[出欠をupsert]
  H --> J[メッセージ保存]
  H --> K[セッションリセット]
  H --> L[完了通知 + メニュー]
```

## C. status（登録状況確認）

```mermaid
flowchart TD
  A[開始: startStatusFlow] --> B{児童存在?}
  B -->|no| C[settingsへ遷移 (resume=status)]
  B -->|yes| D[choose_student]

  D -->|児童選択| E[choose_range]
  D -->|名前テキスト一致| E
  D -->|不一致| D1[再選択要求]

  E -->|次回〜3回| F[dates生成]
  E -->|今月| G[dates生成]
  E -->|日付指定| H[dates生成]
  E -->|不正| E1[再選択要求]

  F --> I[sendStatusSummary]
  G --> I
  H --> I

  I --> J[出欠マップ取得]
  I --> K[返信文生成]
  I --> L[セッションリセット]
  I --> M[一覧返信 + メニュー]
```

## D. settings（児童追加）

```mermaid
flowchart TD
  A[開始: startSettingsFlow] --> B[ask_child_name]
  B -->|名前入力OK| C[ask_child_grade]
  B -->|空入力| B1[再入力要求]

  C -->|grade選択/入力| D[児童作成]
  D --> E[ask_more_children]

  E -->|追加する| B
  E -->|これで完了| F[finishSettingsFlow]
  F --> G[セッションリセット]
  F --> H[メニュー案内]
  F --> I{resumeFlow?}
  I -->|attendance| J[出欠登録フローへ]
  I -->|status| K[登録状況確認フローへ]
```

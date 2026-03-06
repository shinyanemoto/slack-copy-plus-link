# Slack Copy Plus Link (MVP)

Slack Web (`https://app.slack.com/*`) 上で、メッセージ本文とメッセージリンクを一括コピーする Chrome 拡張です。

## 機能

- メッセージにマウスオーバーすると `Copy` ボタンを表示
- `Copy` クリックで `本文 + permalink` をコピー
- キーボードショートカットでもコピー可能
  - 既定: `Alt + Shift + C`
- 拡張アイコンのクリックでも同じ処理を実行

## インストール

1. Chrome で `chrome://extensions` を開く
2. `デベロッパーモード` を ON
3. `パッケージ化されていない拡張機能を読み込む` でこのフォルダを選択

## 使い方

1. Slack Web で任意のチャンネルを開く
2. 対象メッセージにカーソルを合わせて `Copy` をクリック  
   または `Alt + Shift + C` を押す
3. 以下形式でクリップボードへコピーされる

```text
<message text>
https://app.slack.com/archives/<channel>/p<timestamp>
```

## 注意点 (MVP)

- Slack の DOM 変更でセレクタが効かなくなる可能性があります
- スレッドや特殊メッセージの本文抽出は取りこぼす場合があります
- ショートカットは `chrome://extensions/shortcuts` で変更可能です

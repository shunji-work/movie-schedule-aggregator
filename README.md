# Movie Schedule Aggregator

近くの映画館で「今から観られる映画」を探しやすくする、映画上映スケジュール横断検索アプリです。

TOHOシネマズのライブ上映データを優先して取得し、現在地または選択した駅を基準に、上映開始時刻・距離・作品情報をまとめて比較できます。

## 主な機能

### すぐ観る

- 現在時刻から90分以内に始まる上映を表示
- おすすめ順、開始が早い順、近い順、注目度順で並び替え
- 最速、最寄り、高評価などのバッジ表示
- 現在地または選択した駅からの距離を表示

### 位置基準の切り替え

- `現在地` モード: ブラウザの位置情報を使って距離を計算
- `駅` モード: 選択した駅を中心に距離を計算
- 駅名・地域名で検索できる駅ピッカー
- 位置情報を許可しない場合も、選択中の駅を基準に利用可能
- 選択したモードと駅はブラウザに保存

駅リストは都市部の主要駅を中心に収録しています。全国全駅を本格対応する場合は、駅検索APIや駅データセットを別途組み込む想定です。

### 作品一覧

- 上映中の作品をグリッド表示
- 作品を選ぶと、その日の上映を近い映画館順に表示
- 観た映画として鑑賞履歴に記録

### タイムライン

- お気に入り登録した映画館の上映だけを時系列で表示
- マイシアターとして使う映画館を絞り込める

### 映画館

- 距離順で映画館を表示
- 劇場チェーンごとの色分け
- お気に入り登録/解除
- Google Mapsで開くリンク

### プロフィール

- 鑑賞履歴をローカルに保存
- 映画ごとにメモを記録

## データ取得

データは以下の順で利用します。

1. TOHOシネマズのライブ上映データ
2. Supabaseに保存されたデータ
3. デモデータ

ローカル開発時の `/api/toho` は `vite.config.ts` の proxy により、デプロイ済みAPIへ転送されます。Vercel上では `api/toho.js` がTOHOデータ収集処理を実行します。

## サムネイル処理

TOHOの上映コードによっては、字幕版には画像があり、吹替版・Dolby・IMAXなどには画像がないことがあります。

このアプリでは以下の順でサムネイルを補完します。

- TOHO APIの `mcode` がある場合は、作品マスターコードを優先
- 同じ作品タイトルから形式表記を除いて候補URLを共有
- 画像取得に失敗した場合は、同一作品グループの別画像へフォールバック
- すべて失敗した場合はアプリ内の代替画像を表示

## 技術スタック

- React 18
- TypeScript
- Vite 7
- React Router
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React
- Supabase

## セットアップ

```bash
npm install
```

開発サーバーを起動します。

```bash
npm run dev
```

プロダクションビルドを確認します。

```bash
npm run build
npm run preview
```

## 環境変数

Supabaseを使う場合のみ `.env` に設定します。未設定でもTOHOライブデータまたはデモデータで動作します。

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 開発コマンド

```bash
npm run dev          # 開発サーバー
npm run build        # 型チェック込みの本番ビルド
npm run preview      # dist のプレビュー
npm run typecheck    # TypeScript 型チェック
npm run lint         # ESLint
npm test             # TOHO collector のテスト
npm run collect:toho # TOHOデータをJSONとして収集
```

## データベース

Supabase用のマイグレーションは `supabase/migrations` にあります。

主なテーブル:

- `movies`: 映画マスタ
- `theaters`: 劇場マスタ
- `showtimes`: 上映スケジュール
- `user_favorite_theaters`: お気に入り映画館
- `user_watched_movies`: 鑑賞履歴とメモ

現在のアプリでは、お気に入り映画館と鑑賞履歴はブラウザの `localStorage` を使って保存します。

## 想定ユーザー

- 映画館でよく映画を観る人
- 今から観られる上映をすばやく探したい人
- 複数の映画館を比較して選びたい人
- 現在地を使わず、駅を基準に探したい人
- 観た映画のメモを残したい人

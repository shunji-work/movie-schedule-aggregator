/*
  # 映画テーブルにランキングと評価を追加

  1. 変更内容
    - `movies` テーブルに以下のカラムを追加
      - `ranking` (integer) - 映画の表示順位（小さい数字ほど上位）
      - `rating` (decimal) - Filmarksの評価スコア（1.0〜5.0）
  
  2. 注意事項
    - 既存データに影響を与えないようにカラムを追加
    - ranking は NULL を許可（後から更新）
    - rating は NULL を許可（評価がない場合もある）
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movies' AND column_name = 'ranking'
  ) THEN
    ALTER TABLE movies ADD COLUMN ranking integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'movies' AND column_name = 'rating'
  ) THEN
    ALTER TABLE movies ADD COLUMN rating decimal(2, 1);
  END IF;
END $$;
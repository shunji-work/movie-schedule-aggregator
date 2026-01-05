/*
  # My Theaters データベーススキーマ

  1. テーブル構成
    - `theaters` - 劇場情報
      - id (uuid, primary key)
      - name (text) - 劇場名
      - chain (text) - チェーン名（TOHOシネマズ、ユナイテッド・シネマなど）
      - latitude (float) - 緯度
      - longitude (float) - 経度
      - address (text) - 住所
      - created_at (timestamp)
    
    - `movies` - 映画情報
      - id (uuid, primary key)
      - title (text) - 映画タイトル
      - poster_url (text) - ポスター画像URL
      - duration (int) - 上映時間（分）
      - genre (text) - ジャンル
      - created_at (timestamp)
    
    - `showtimes` - 上映時間
      - id (uuid, primary key)
      - theater_id (uuid, FK to theaters)
      - movie_id (uuid, FK to movies)
      - showtime (timestamp) - 上映開始時刻
      - screen (text) - スクリーン番号
      - created_at (timestamp)
    
    - `user_favorite_theaters` - ユーザーのお気に入り劇場（マイシアター）
      - id (uuid, primary key)
      - user_id (uuid, FK to auth.users)
      - theater_id (uuid, FK to theaters)
      - created_at (timestamp)
    
    - `user_watchlist` - ユーザーの見たいリスト
      - id (uuid, primary key)
      - user_id (uuid, FK to auth.users)
      - movie_id (uuid, FK to movies)
      - created_at (timestamp)
    
    - `user_watched_movies` - ユーザーの視聴履歴
      - id (uuid, primary key)
      - user_id (uuid, FK to auth.users)
      - movie_id (uuid, FK to movies)
      - theater_id (uuid, FK to theaters, nullable)
      - watched_at (timestamp)
      - memo (text, nullable)
      - created_at (timestamp)

  2. セキュリティ
    - 全テーブルでRLSを有効化
    - theatersとmoviesとshowtimesは全ユーザーが閲覧可能
    - user_*テーブルは認証ユーザーが自分のデータのみアクセス可能
*/

-- 劇場テーブル
CREATE TABLE IF NOT EXISTS theaters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  chain text NOT NULL,
  latitude float8 NOT NULL,
  longitude float8 NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE theaters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "theaters_select_policy"
  ON theaters FOR SELECT
  TO authenticated
  USING (true);

-- 映画テーブル
CREATE TABLE IF NOT EXISTS movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  poster_url text DEFAULT '',
  duration int DEFAULT 120,
  genre text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movies_select_policy"
  ON movies FOR SELECT
  TO authenticated
  USING (true);

-- 上映時間テーブル
CREATE TABLE IF NOT EXISTS showtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theater_id uuid NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  showtime timestamptz NOT NULL,
  screen text DEFAULT '1',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE showtimes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "showtimes_select_policy"
  ON showtimes FOR SELECT
  TO authenticated
  USING (true);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_showtimes_theater_id ON showtimes(theater_id);
CREATE INDEX IF NOT EXISTS idx_showtimes_movie_id ON showtimes(movie_id);
CREATE INDEX IF NOT EXISTS idx_showtimes_showtime ON showtimes(showtime);

-- ユーザーのお気に入り劇場テーブル
CREATE TABLE IF NOT EXISTS user_favorite_theaters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theater_id uuid NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, theater_id)
);

ALTER TABLE user_favorite_theaters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_favorite_theaters_select_policy"
  ON user_favorite_theaters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_favorite_theaters_insert_policy"
  ON user_favorite_theaters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_favorite_theaters_delete_policy"
  ON user_favorite_theaters FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ユーザーの見たいリストテーブル
CREATE TABLE IF NOT EXISTS user_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, movie_id)
);

ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_watchlist_select_policy"
  ON user_watchlist FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_watchlist_insert_policy"
  ON user_watchlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_watchlist_delete_policy"
  ON user_watchlist FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ユーザーの視聴履歴テーブル
CREATE TABLE IF NOT EXISTS user_watched_movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  movie_id uuid NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  theater_id uuid REFERENCES theaters(id) ON DELETE SET NULL,
  watched_at timestamptz DEFAULT now(),
  memo text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_watched_movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_watched_movies_select_policy"
  ON user_watched_movies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_watched_movies_insert_policy"
  ON user_watched_movies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_watched_movies_update_policy"
  ON user_watched_movies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_watched_movies_delete_policy"
  ON user_watched_movies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
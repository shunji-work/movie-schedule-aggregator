/*
  # ユーザーテーブルのRLSポリシーを更新

  1. 変更内容
    - user_favorite_theaters, user_watchlist, user_watched_moviesのポリシーを更新
    - 匿名ユーザーもアクセス可能にする（ただし空のデータを返す）
    - これにより、認証なしでもアプリが正常に動作します

  2. セキュリティ
    - 匿名ユーザーは自分のデータがないため、空の結果が返されます
    - 認証ユーザーは引き続き自分のデータのみアクセス可能
*/

-- user_favorite_theaters
DROP POLICY IF EXISTS "user_favorite_theaters_select_policy" ON user_favorite_theaters;
CREATE POLICY "user_favorite_theaters_select_policy"
  ON user_favorite_theaters FOR SELECT
  TO anon, authenticated
  USING (
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE auth.uid() = user_id
    END
  );

-- user_watchlist
DROP POLICY IF EXISTS "user_watchlist_select_policy" ON user_watchlist;
CREATE POLICY "user_watchlist_select_policy"
  ON user_watchlist FOR SELECT
  TO anon, authenticated
  USING (
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE auth.uid() = user_id
    END
  );

-- user_watched_movies
DROP POLICY IF EXISTS "user_watched_movies_select_policy" ON user_watched_movies;
CREATE POLICY "user_watched_movies_select_policy"
  ON user_watched_movies FOR SELECT
  TO anon, authenticated
  USING (
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE auth.uid() = user_id
    END
  );

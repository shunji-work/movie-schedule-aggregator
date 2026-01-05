/*
  # RLSポリシーを更新して匿名ユーザーもアクセス可能にする

  1. 変更内容
    - theaters, movies, showtimesテーブルのSELECTポリシーを更新
    - 認証ユーザーだけでなく、匿名ユーザー(anon)もデータを閲覧可能に変更
    - これにより、ログインなしでも映画や劇場のデータを閲覧できるようになります

  2. セキュリティ
    - 読み取り専用のため、データの改ざんリスクはありません
    - ユーザー固有のデータ（お気に入り、視聴履歴）は引き続き認証が必要です
*/

-- theatersテーブルのポリシーを更新
DROP POLICY IF EXISTS "theaters_select_policy" ON theaters;
CREATE POLICY "theaters_select_policy"
  ON theaters FOR SELECT
  TO anon, authenticated
  USING (true);

-- moviesテーブルのポリシーを更新
DROP POLICY IF EXISTS "movies_select_policy" ON movies;
CREATE POLICY "movies_select_policy"
  ON movies FOR SELECT
  TO anon, authenticated
  USING (true);

-- showtimesテーブルのポリシーを更新
DROP POLICY IF EXISTS "showtimes_select_policy" ON showtimes;
CREATE POLICY "showtimes_select_policy"
  ON showtimes FOR SELECT
  TO anon, authenticated
  USING (true);

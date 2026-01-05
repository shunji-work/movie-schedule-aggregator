import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Film, Calendar } from 'lucide-react';
import { supabase, type UserWatchedMovie, type Movie, type Theater } from '@/lib/supabase';
import { getTheaterChainColor } from '@/lib/theater-colors';

type WatchedMovieWithDetails = UserWatchedMovie & {
  movie: Movie;
  theater: Theater | null;
};

export function Profile() {
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovieWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMemo, setEditingMemo] = useState<string | null>(null);
  const [memoText, setMemoText] = useState('');

  useEffect(() => {
    loadWatchedMovies();
  }, []);

  const loadWatchedMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('user_watched_movies')
        .select(`
          *,
          movie:movies(*),
          theater:theaters(*)
        `)
        .order('watched_at', { ascending: false });

      if (error) throw error;

      setWatchedMovies(data || []);
    } catch (error) {
      console.error('Error loading watched movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditingMemo = (watchedMovie: WatchedMovieWithDetails) => {
    setEditingMemo(watchedMovie.id);
    setMemoText(watchedMovie.memo || '');
  };

  const saveMemo = async (id: string) => {
    try {
      await supabase
        .from('user_watched_movies')
        .update({ memo: memoText })
        .eq('id', id);

      setWatchedMovies((prev) =>
        prev.map((wm) => (wm.id === id ? { ...wm, memo: memoText } : wm))
      );

      setEditingMemo(null);
    } catch (error) {
      console.error('Error saving memo:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">マイページ</h2>
        <p className="text-slate-600">視聴履歴とメモ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            視聴した映画
          </CardTitle>
        </CardHeader>
        <CardContent>
          {watchedMovies.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              視聴履歴がありません
            </div>
          ) : (
            <div className="space-y-4">
              {watchedMovies.map((watchedMovie) => {
                const watchedDate = new Date(watchedMovie.watched_at);
                const colorClass = watchedMovie.theater
                  ? getTheaterChainColor(watchedMovie.theater.chain)
                  : 'bg-gray-500';

                return (
                  <div
                    key={watchedMovie.id}
                    className="border-l-4 border-slate-300 pl-4 py-3"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-24 bg-slate-200 rounded overflow-hidden">
                          {watchedMovie.movie.poster_url ? (
                            <img
                              src={watchedMovie.movie.poster_url}
                              alt={watchedMovie.movie.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center px-1">
                              No Image
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-slate-900 mb-1">
                          {watchedMovie.movie.title}
                        </h3>
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {watchedDate.toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          {watchedMovie.theater && (
                            <div className="flex items-center gap-2">
                              <Badge className={`${colorClass} text-white`}>
                                {watchedMovie.theater.chain}
                              </Badge>
                              <span className="text-slate-700">
                                {watchedMovie.theater.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {editingMemo === watchedMovie.id ? (
                      <div className="space-y-2 mt-3">
                        <Textarea
                          value={memoText}
                          onChange={(e) => setMemoText(e.target.value)}
                          placeholder="感想やメモを入力..."
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveMemo(watchedMovie.id)}
                          >
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingMemo(null)}
                          >
                            キャンセル
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        {watchedMovie.memo ? (
                          <div className="bg-slate-50 p-3 rounded text-sm text-slate-700 mb-2">
                            {watchedMovie.memo}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400 mb-2">
                            メモなし
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditingMemo(watchedMovie)}
                        >
                          メモを編集
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

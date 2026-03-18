import { useEffect, useState } from 'react';
import { CalendarDays, Clapperboard, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  listWatchedMovies,
  updateWatchedMovieMemo,
  type WatchedMovieWithDetails,
} from '@/lib/app-data';
import { getTheaterChainColor } from '@/lib/theater-colors';

export function Profile() {
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovieWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memo, setMemo] = useState('');

  const reload = () => {
    setLoading(true);
    listWatchedMovies()
      .then(setWatchedMovies)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, []);

  const startEditing = (item: WatchedMovieWithDetails) => {
    setEditingId(item.id);
    setMemo(item.memo);
  };

  const saveMemo = () => {
    if (!editingId) {
      return;
    }

    updateWatchedMovieMemo(editingId, memo);
    setWatchedMovies((current) =>
      current.map((item) => (item.id === editingId ? { ...item, memo } : item))
    );
    setEditingId(null);
    setMemo('');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">プロフィール</h2>
        <p className="text-sm text-slate-600">
          記録した鑑賞履歴を一覧できます。メモはローカルに保存されます。
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5" />
            鑑賞履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">鑑賞履歴を読み込み中です。</div>
          ) : watchedMovies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              まだ鑑賞履歴はありません。作品ページから「観た映画として記録」を押すと追加されます。
            </div>
          ) : (
            <div className="space-y-4">
              {watchedMovies.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="h-28 w-20 overflow-hidden rounded-xl bg-slate-200">
                      <img
                        src={item.movie.poster_url}
                        alt={item.movie.title}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {item.movie.title}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {item.movie.genre} ・ {item.movie.duration}分
                          </p>
                        </div>
                        {item.theater ? (
                          <Badge className={`${getTheaterChainColor(item.theater.chain)} text-white`}>
                            {item.theater.chain}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-slate-400" />
                          <span>
                            {new Date(item.watched_at).toLocaleString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {item.theater ? <span>{item.theater.name}</span> : null}
                      </div>

                      {editingId === item.id ? (
                        <div className="space-y-3">
                          <Textarea
                            value={memo}
                            onChange={(event) => setMemo(event.target.value)}
                            rows={4}
                            placeholder="感想やメモを入力"
                          />
                          <div className="flex gap-2">
                            <Button onClick={saveMemo}>保存</Button>
                            <Button variant="outline" onClick={() => setEditingId(null)}>
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                            {item.memo || 'まだメモはありません。'}
                          </div>
                          <Button variant="outline" size="sm" onClick={() => startEditing(item)}>
                            <PencilLine className="mr-2 h-4 w-4" />
                            メモを編集
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

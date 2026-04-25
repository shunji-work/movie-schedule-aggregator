import { useEffect, useState } from 'react';
import { Clock3, Heart, MapPin, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PosterImage } from '@/components/PosterImage';
import { listTimelineShowtimes, type ShowtimeWithDetails } from '@/lib/app-data';
import { formatDistance } from '@/lib/geolocation';
import { getTheaterChainBorderColor, getTheaterChainColor } from '@/lib/theater-colors';
import { useUserLocation } from '@/hooks/useUserLocation';

function formatShowtime(showtime: string) {
  return new Date(showtime).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Timeline() {
  const { location } = useUserLocation();
  const [showtimes, setShowtimes] = useState<ShowtimeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) return;

    let cancelled = false;

    setLoading(true);
    listTimelineShowtimes(location)
      .then((items) => {
        if (!cancelled) {
          setShowtimes(items);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-rose-500" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">お気に入り映画館のタイムライン</h2>
            <p className="text-sm text-slate-600">
              登録した映画館だけに絞って、今日これから観られる上映を並べています。
            </p>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          タイムラインを読み込み中です。
        </div>
      ) : showtimes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          お気に入り映画館がまだありません。映画館ページで登録すると、この画面に上映が並びます。
        </div>
      ) : (
        <div className="space-y-4">
          {showtimes.map((showtime) => (
            <Card
              key={showtime.id}
              className={`overflow-hidden border-l-4 ${getTheaterChainBorderColor(
                showtime.theater.chain
              )}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="h-28 w-20 overflow-hidden rounded-xl bg-slate-200">
                    <PosterImage
                      src={showtime.movie.poster_url}
                      alt={showtime.movie.title}
                      className="h-full w-full bg-slate-100 object-contain p-1.5"
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {showtime.movie.title}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {showtime.movie.genre} ・ {showtime.movie.duration}分
                        </p>
                      </div>
                      <Badge className={`${getTheaterChainColor(showtime.theater.chain)} text-white`}>
                        {showtime.theater.chain}
                      </Badge>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-slate-400" />
                        <span className="font-semibold text-slate-900">
                          {formatShowtime(showtime.showtime)}
                        </span>
                        <span>スクリーン {showtime.screen}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{showtime.theater.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Navigation className="h-4 w-4 text-slate-400" />
                        <span>{formatDistance(showtime.distance ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

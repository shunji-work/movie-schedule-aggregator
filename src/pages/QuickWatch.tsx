import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Clock3,
  MapPin,
  Navigation,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PosterImage } from '@/components/PosterImage';
import { listQuickWatchShowtimes, type ShowtimeWithDetails } from '@/lib/app-data';
import { formatDistance } from '@/lib/geolocation';
import { getTheaterChainBorderColor, getTheaterChainColor } from '@/lib/theater-colors';
import { useUserLocation } from '@/hooks/useUserLocation';

type SortMode = 'recommended' | 'time' | 'distance' | 'ranking';

function getMinutesUntilStart(showtime: string) {
  return Math.max(
    0,
    Math.floor((new Date(showtime).getTime() - Date.now()) / (1000 * 60))
  );
}

function formatShowtime(showtime: string) {
  return new Date(showtime).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function QuickWatch() {
  const { location, status } = useUserLocation();
  const [showtimes, setShowtimes] = useState<ShowtimeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('recommended');

  useEffect(() => {
    if (!location) return;

    let cancelled = false;

    setLoading(true);
    listQuickWatchShowtimes(location)
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

  const sortedShowtimes = useMemo(() => {
    const items = [...showtimes];

    if (sortMode === 'distance') {
      return items.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }

    if (sortMode === 'time') {
      return items.sort(
        (a, b) => new Date(a.showtime).getTime() - new Date(b.showtime).getTime()
      );
    }

    if (sortMode === 'ranking') {
      return items.sort(
        (a, b) => (a.movie.ranking ?? 999) - (b.movie.ranking ?? 999)
      );
    }

    const maxDistance = Math.max(...items.map((item) => item.distance ?? 0), 1);
    const minTime = Math.min(
      ...items.map((item) => new Date(item.showtime).getTime()),
      Date.now()
    );
    const maxTime = Math.max(...items.map((item) => new Date(item.showtime).getTime()));

    return items
      .map((item) => {
        const distanceScore = 1 - (item.distance ?? 0) / maxDistance;
        const rankingScore = 1 - Math.min((item.movie.ranking ?? 100) / 100, 1);
        const ratingScore = (item.movie.rating ?? 0) / 5;
        const timeRange = Math.max(maxTime - minTime, 1);
        const timeScore = 1 - (new Date(item.showtime).getTime() - minTime) / timeRange;

        return {
          item,
          score:
            distanceScore * 0.55 +
            timeScore * 0.25 +
            rankingScore * 0.15 +
            ratingScore * 0.05,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [showtimes, sortMode]);

  const nearestId = useMemo(() => {
    return sortedShowtimes.reduce<string | null>((current, item) => {
      if (!current) {
        return item.id;
      }

      const currentItem = sortedShowtimes.find((entry) => entry.id === current);
      return (item.distance ?? Infinity) < (currentItem?.distance ?? Infinity)
        ? item.id
        : current;
    }, null);
  }, [sortedShowtimes]);

  const earliestId = useMemo(() => {
    return sortedShowtimes.reduce<string | null>((current, item) => {
      if (!current) {
        return item.id;
      }

      const currentItem = sortedShowtimes.find((entry) => entry.id === current);
      return new Date(item.showtime).getTime() < new Date(currentItem!.showtime).getTime()
        ? item.id
        : current;
    }, null);
  }, [sortedShowtimes]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-900 px-6 py-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge className="bg-white/10 text-white hover:bg-white/10">
              <Zap className="mr-1 h-3 w-3" />
              今から90分以内
            </Badge>
            <div>
              <h2 className="text-3xl font-bold">すぐ観られる上映</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                現在地に近くて、すぐ出発できる上映を横断的に集めています。
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100">
            <div className="font-semibold">
              {status === 'detecting' ? '位置情報を取得中...' : status === 'fallback' ? '位置情報を取得できませんでした' : '現在地で表示中'}
            </div>
            {location && (
              <div className="text-slate-300">
                {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={sortMode === 'recommended' ? 'default' : 'outline'}
          onClick={() => setSortMode('recommended')}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          おすすめ順
        </Button>
        <Button
          variant={sortMode === 'time' ? 'default' : 'outline'}
          onClick={() => setSortMode('time')}
        >
          <Clock3 className="mr-2 h-4 w-4" />
          開始が早い順
        </Button>
        <Button
          variant={sortMode === 'distance' ? 'default' : 'outline'}
          onClick={() => setSortMode('distance')}
        >
          <Navigation className="mr-2 h-4 w-4" />
          近い順
        </Button>
        <Button
          variant={sortMode === 'ranking' ? 'default' : 'outline'}
          onClick={() => setSortMode('ranking')}
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          注目度順
        </Button>
      </div>

      {status === 'fallback' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          位置情報へのアクセスが許可されていません。ブラウザの設定から位置情報の使用を許可してください。
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {status === 'detecting' ? '位置情報を取得中です。' : '上映情報を読み込み中です。'}
        </div>
      ) : sortedShowtimes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          90分以内に始まる上映が見つかりませんでした。少し時間をおいて再確認してください。
        </div>
      ) : (
        <div className="space-y-4">
          {sortedShowtimes.map((showtime) => {
            const badges = [
              showtime.id === earliestId
                ? { label: '最速', icon: Clock3, color: 'bg-red-500' }
                : null,
              showtime.id === nearestId
                ? { label: '最寄り', icon: Navigation, color: 'bg-emerald-500' }
                : null,
              (showtime.movie.rating ?? 0) >= 4.2
                ? { label: '高評価', icon: Award, color: 'bg-sky-500' }
                : null,
            ].filter(Boolean) as Array<{
              label: string;
              icon: typeof Clock3;
              color: string;
            }>;

            return (
              <Card
                key={showtime.id}
                className={`overflow-hidden border-l-4 ${getTheaterChainBorderColor(
                  showtime.theater.chain
                )}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="h-32 w-24 overflow-hidden rounded-xl bg-slate-200">
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

                      <div className="flex flex-wrap gap-2">
                        {badges.map((badge) => (
                          <Badge key={badge.label} className={`${badge.color} text-white`}>
                            <badge.icon className="mr-1 h-3 w-3" />
                            {badge.label}
                          </Badge>
                        ))}
                        {showtime.movie.rating ? (
                          <Badge variant="outline" className="border-slate-300 text-slate-700">
                            ★ {showtime.movie.rating.toFixed(1)}
                          </Badge>
                        ) : null}
                        {showtime.movie.ranking ? (
                          <Badge variant="outline" className="border-slate-300 text-slate-700">
                            注目度 {showtime.movie.ranking}位
                          </Badge>
                        ) : null}
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          <span className="font-semibold text-slate-900">
                            {formatShowtime(showtime.showtime)}
                          </span>
                          <span>あと{getMinutesUntilStart(showtime.showtime)}分</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span className="truncate">{showtime.theater.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-slate-400" />
                          <span>{formatDistance(showtime.distance ?? 0)}</span>
                          <span>スクリーン {showtime.screen}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

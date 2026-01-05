import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Star, Zap, Navigation, TrendingUp, Award, Sparkles } from 'lucide-react';
import { supabase, type Showtime, type Theater, type Movie } from '@/lib/supabase';
import { getTheaterChainColor, getTheaterChainBorderColor } from '@/lib/theater-colors';
import { calculateDistance, formatDistance, getMockLocation } from '@/lib/geolocation';

type ShowtimeWithDetails = Showtime & {
  theater: Theater;
  movie: Movie;
  distance?: number;
};

type SortMode = 'recommended' | 'ranking' | 'distance' | 'time';

export function QuickWatch() {
  const [showtimes, setShowtimes] = useState<ShowtimeWithDetails[]>([]);
  const [sortedShowtimes, setSortedShowtimes] = useState<ShowtimeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('recommended');

  useEffect(() => {
    loadShowtimes();
  }, []);

  useEffect(() => {
    if (showtimes.length > 0) {
      applySorting();
    }
  }, [showtimes, sortMode]);

  const loadShowtimes = async () => {
    try {
      const userLocation = getMockLocation();
      const now = new Date();
      const in10Minutes = new Date(now.getTime() + 10 * 60 * 1000);
      const in90Minutes = new Date(now.getTime() + 90 * 60 * 1000);

      const { data, error } = await supabase
        .from('showtimes')
        .select(`
          *,
          theater:theaters(*),
          movie:movies(*)
        `)
        .gte('showtime', in10Minutes.toISOString())
        .lte('showtime', in90Minutes.toISOString())
        .order('showtime', { ascending: true });

      if (error) throw error;

      const showtimesWithDistance = data?.map((showtime: any) => ({
        ...showtime,
        distance: calculateDistance(userLocation, {
          latitude: showtime.theater.latitude,
          longitude: showtime.theater.longitude,
        }),
      })) || [];

      setShowtimes(showtimesWithDistance);
    } catch (error) {
      console.error('Error loading showtimes:', error);
    } finally {
      setLoading(false);
    }
  };

  const applySorting = () => {
    let sorted = [...showtimes];

    switch (sortMode) {
      case 'recommended':
        sorted = applyRecommendedSort(sorted);
        break;
      case 'ranking':
        sorted = applyRankingSort(sorted);
        break;
      case 'distance':
        sorted.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        break;
      case 'time':
        sorted.sort((a, b) =>
          new Date(a.showtime).getTime() - new Date(b.showtime).getTime()
        );
        break;
    }

    setSortedShowtimes(sorted);
  };

  const applyRecommendedSort = (items: ShowtimeWithDetails[]) => {
    if (items.length === 0) return items;

    const now = new Date().getTime();
    const maxDistance = Math.max(...items.map(s => s.distance || 0));
    const minTime = Math.min(...items.map(s => new Date(s.showtime).getTime()));
    const maxTime = Math.max(...items.map(s => new Date(s.showtime).getTime()));

    const scored = items.map(showtime => {
      const distanceScore = maxDistance > 0
        ? 1 - ((showtime.distance || 0) / maxDistance)
        : 1;

      const timeValue = new Date(showtime.showtime).getTime() - now;
      const timeRange = maxTime - minTime;
      const timeScore = timeRange > 0
        ? 1 - ((timeValue - (minTime - now)) / timeRange)
        : 1;

      const ranking = showtime.movie.ranking || 999;
      const rankingScore = Math.max(0, 1 - (ranking / 100));

      const rating = showtime.movie.rating || 0;
      const ratingScore = rating / 5;

      const totalScore = (distanceScore * 0.6) + (timeScore * 0.2) + (rankingScore * 0.15) + (ratingScore * 0.05);

      return {
        showtime,
        score: totalScore
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.showtime);
  };

  const applyRankingSort = (items: ShowtimeWithDetails[]) => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      const rankA = a.movie.ranking || 999;
      const rankB = b.movie.ranking || 999;
      return rankA - rankB;
    });

    const result: ShowtimeWithDetails[] = [];
    const movieGroups = new Map<string, ShowtimeWithDetails[]>();

    for (const item of sorted) {
      if (!movieGroups.has(item.movie_id)) {
        movieGroups.set(item.movie_id, []);
      }
      movieGroups.get(item.movie_id)!.push(item);
    }

    let consecutiveCount = 0;
    let lastMovieId: string | null = null;

    while (result.length < sorted.length) {
      let added = false;

      for (const [movieId, group] of movieGroups.entries()) {
        if (group.length === 0) continue;

        if (lastMovieId === movieId && consecutiveCount >= 4) {
          continue;
        }

        result.push(group.shift()!);

        if (lastMovieId === movieId) {
          consecutiveCount++;
        } else {
          consecutiveCount = 1;
          lastMovieId = movieId;
        }

        added = true;
        break;
      }

      if (!added) {
        for (const [movieId, group] of movieGroups.entries()) {
          if (group.length > 0) {
            result.push(group.shift()!);
            consecutiveCount = 1;
            lastMovieId = movieId;
            break;
          }
        }
      }
    }

    return result;
  };

  const getBadges = (showtime: ShowtimeWithDetails) => {
    const badges = [];

    if (showtimes.length > 0) {
      const earliestTime = Math.min(...showtimes.map(s => new Date(s.showtime).getTime()));
      if (new Date(showtime.showtime).getTime() === earliestTime) {
        badges.push({ label: '早', icon: Zap, color: 'bg-red-500', tooltip: '最速上映' });
      }

      const nearestDistance = Math.min(...showtimes.map(s => s.distance || 999));
      if (showtime.distance === nearestDistance) {
        badges.push({ label: '近', icon: Navigation, color: 'bg-green-500', tooltip: '最寄り' });
      }
    }

    if (showtime.movie.rating && showtime.movie.rating >= 4.0) {
      badges.push({ label: '高評', icon: Award, color: 'bg-blue-500', tooltip: '高評価' });
    }

    if (showtime.movie.ranking && showtime.movie.ranking <= 10) {
      badges.push({ label: '旬', icon: TrendingUp, color: 'bg-amber-500', tooltip: 'ランキング上位' });
    }

    return badges;
  };

  const getMinutesUntilStart = (showtimeStr: string) => {
    const now = new Date();
    const showtime = new Date(showtimeStr);
    const diff = showtime.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-600">読み込み中...</div>
      </div>
    );
  }

  if (sortedShowtimes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Clock className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">
          今から90分以内の上映がありません
        </h2>
        <p className="text-slate-500">
          時間を置いて再度確認してください
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Zap className="w-7 h-7 text-red-500" />
          すぐ観る！
        </h2>
        <p className="text-slate-600">今から90分以内に始まる周辺の映画</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          variant={sortMode === 'recommended' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortMode('recommended')}
          className="flex items-center gap-1"
        >
          <Sparkles className="w-4 h-4" />
          おすすめ
        </Button>
        <Button
          variant={sortMode === 'ranking' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortMode('ranking')}
          className="flex items-center gap-1"
        >
          <TrendingUp className="w-4 h-4" />
          ランキング順
        </Button>
        <Button
          variant={sortMode === 'distance' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortMode('distance')}
          className="flex items-center gap-1"
        >
          <Navigation className="w-4 h-4" />
          近い順
        </Button>
        <Button
          variant={sortMode === 'time' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortMode('time')}
          className="flex items-center gap-1"
        >
          <Zap className="w-4 h-4" />
          早い順
        </Button>
      </div>

      <div className="space-y-3">
        {sortedShowtimes.map((showtime) => {
          const showtimeDate = new Date(showtime.showtime);
          const colorClass = getTheaterChainColor(showtime.theater.chain);
          const borderClass = getTheaterChainBorderColor(showtime.theater.chain);
          const badges = getBadges(showtime);
          const minutesUntil = getMinutesUntilStart(showtime.showtime);

          return (
            <Card
              key={showtime.id}
              className={`border-l-4 ${borderClass} hover:shadow-lg transition-shadow`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-28 bg-slate-200 rounded overflow-hidden">
                      {showtime.movie.poster_url ? (
                        <img
                          src={showtime.movie.poster_url}
                          alt={showtime.movie.title}
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
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-slate-900 leading-tight mb-1">
                          {showtime.movie.title}
                        </h3>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {badges.map((badge, idx) => (
                            <Badge
                              key={idx}
                              className={`${badge.color} text-white text-xs px-2 py-0.5 flex items-center gap-1`}
                              title={badge.tooltip}
                            >
                              <badge.icon className="w-3 h-3" />
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                        {showtime.movie.rating && (
                          <div className="flex items-center gap-1 text-amber-600 mb-2">
                            <Star className="w-3 h-3 fill-amber-600" />
                            <span className="text-xs font-semibold">{showtime.movie.rating}</span>
                          </div>
                        )}
                      </div>
                      <Badge className={`${colorClass} text-white flex-shrink-0`}>
                        {showtime.theater.chain}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{showtime.theater.name}</span>
                        {showtime.distance !== undefined && (
                          <span className="text-slate-500 font-medium">
                            {formatDistance(showtime.distance)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span className="font-bold text-slate-900 text-base">
                          {showtimeDate.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-red-600 font-semibold">
                          あと{minutesUntil}分
                        </span>
                        <span className="text-slate-500">
                          / {showtime.movie.duration}分
                        </span>
                      </div>

                      <div className="text-slate-500">
                        スクリーン{showtime.screen}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

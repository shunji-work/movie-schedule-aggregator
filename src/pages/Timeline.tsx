import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Star } from 'lucide-react';
import { supabase, type Showtime, type Theater, type Movie } from '@/lib/supabase';
import { getTheaterChainColor, getTheaterChainBorderColor } from '@/lib/theater-colors';
import { calculateDistance, formatDistance, getMockLocation } from '@/lib/geolocation';

type ShowtimeWithDetails = Showtime & {
  theater: Theater;
  movie: Movie;
  distance?: number;
};

export function Timeline() {
  const [showtimes, setShowtimes] = useState<ShowtimeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShowtimes();
  }, []);

  const loadShowtimes = async () => {
    try {
      const userLocation = getMockLocation();

      const { data: favoriteTheaters } = await supabase
        .from('user_favorite_theaters')
        .select('theater_id');

      const theaterIds = favoriteTheaters?.map((ft) => ft.theater_id) || [];

      if (theaterIds.length === 0) {
        setLoading(false);
        return;
      }

      const now = new Date();
      const in10Minutes = new Date(now.getTime() + 10 * 60 * 1000);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('showtimes')
        .select(`
          *,
          theater:theaters(*),
          movie:movies(*)
        `)
        .in('theater_id', theaterIds)
        .gte('showtime', in10Minutes.toISOString())
        .lte('showtime', endOfDay.toISOString())
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-600">読み込み中...</div>
      </div>
    );
  }

  if (showtimes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <MapPin className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-700 mb-2">
          マイシアターが未登録です
        </h2>
        <p className="text-slate-500">
          劇場マップから劇場を登録すると、上映スケジュールが表示されます
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">今日の上映スケジュール</h2>
        <p className="text-slate-600">マイシアターの上映予定を時系列で表示</p>
      </div>

      {showtimes.map((showtime) => {
        const showtimeDate = new Date(showtime.showtime);
        const colorClass = getTheaterChainColor(showtime.theater.chain);
        const borderClass = getTheaterChainBorderColor(showtime.theater.chain);

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
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        No Image
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">
                        {showtime.movie.title}
                      </h3>
                      {showtime.movie.rating && (
                        <div className="flex items-center gap-1 text-amber-600 mt-1">
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
                        <span className="text-slate-500">
                          ({formatDistance(showtime.distance)})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span className="font-semibold text-slate-900">
                        {showtimeDate.toLocaleTimeString('ja-JP', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-slate-500">
                        開始 / {showtime.movie.duration}分
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
  );
}

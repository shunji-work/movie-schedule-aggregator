import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Star } from 'lucide-react';
import { supabase, type Movie, type Showtime, type Theater } from '@/lib/supabase';
import { getTheaterChainColor, getTheaterChainBorderColor } from '@/lib/theater-colors';
import { calculateDistance, formatDistance, getMockLocation } from '@/lib/geolocation';

type ShowtimeWithTheater = Showtime & {
  theater: Theater;
  distance?: number;
};

type MovieWithShowtimes = Movie & {
  showtimes: ShowtimeWithTheater[];
};

export function Movies() {
  const [movies, setMovies] = useState<MovieWithShowtimes[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<MovieWithShowtimes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    try {
      const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('ranking', { ascending: true });

      if (error) throw error;

      setMovies((data || []) as MovieWithShowtimes[]);
    } catch (error) {
      console.error('Error loading movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadShowtimes = async (movieId: string) => {
    try {
      const userLocation = getMockLocation();
      const now = new Date();
      const in10Minutes = new Date(now.getTime() + 10 * 60 * 1000);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('showtimes')
        .select(`
          *,
          theater:theaters(*)
        `)
        .eq('movie_id', movieId)
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

      showtimesWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));

      const movie = movies.find((m) => m.id === movieId);
      if (movie) {
        setSelectedMovie({
          ...movie,
          showtimes: showtimesWithDistance,
        });
      }
    } catch (error) {
      console.error('Error loading showtimes:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-600">読み込み中...</div>
      </div>
    );
  }

  if (selectedMovie) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          onClick={() => setSelectedMovie(null)}
          className="mb-4"
        >
          ← 作品一覧に戻る
        </Button>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-32 h-48 bg-slate-200 rounded overflow-hidden">
                  {selectedMovie.poster_url ? (
                    <img
                      src={selectedMovie.poster_url}
                      alt={selectedMovie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-center px-2">
                      No Image
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  {selectedMovie.title}
                </h2>
                <div className="space-y-1 text-sm text-slate-600">
                  {selectedMovie.rating && (
                    <div className="flex items-center gap-1 text-amber-600 mb-2">
                      <Star className="w-5 h-5 fill-amber-600" />
                      <span className="text-lg font-semibold">{selectedMovie.rating}</span>
                      <span className="text-slate-500 text-xs ml-1">Filmarks</span>
                    </div>
                  )}
                  <p>上映時間: {selectedMovie.duration}分</p>
                  <p>ジャンル: {selectedMovie.genre}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <h3 className="text-xl font-bold text-slate-900 mb-4">
          今日の上映スケジュール（近い順）
        </h3>

        {selectedMovie.showtimes.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            今日の上映スケジュールがありません
          </div>
        ) : (
          <div className="space-y-3">
            {selectedMovie.showtimes.map((showtime) => {
              const showtimeDate = new Date(showtime.showtime);
              const colorClass = getTheaterChainColor(showtime.theater.chain);
              const borderClass = getTheaterChainBorderColor(showtime.theater.chain);

              return (
                <Card
                  key={showtime.id}
                  className={`border-l-4 ${borderClass} hover:shadow-md transition-shadow`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${colorClass} text-white`}>
                            {showtime.theater.chain}
                          </Badge>
                          <span className="font-semibold text-slate-900">
                            {showtime.theater.name}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{showtime.theater.address}</span>
                            {showtime.distance !== undefined && (
                              <span className="text-slate-500 font-medium">
                                {formatDistance(showtime.distance)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-semibold text-slate-900 text-base">
                              {showtimeDate.toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-slate-500">
                              スクリーン{showtime.screen}
                            </span>
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

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">作品から探す</h2>
        <p className="text-slate-600">見たい映画を選択してください</p>
      </div>

      {movies.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          映画データがありません
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {movies.map((movie) => (
            <Card
              key={movie.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => loadShowtimes(movie.id)}
            >
              <CardContent className="p-0">
                <div className="w-full aspect-[2/3] bg-slate-200 rounded-t overflow-hidden">
                  {movie.poster_url ? (
                    <img
                      src={movie.poster_url}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-center px-2">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight mb-1 line-clamp-2">
                    {movie.title}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-500">{movie.genre}</p>
                    {movie.rating && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-3 h-3 fill-amber-600" />
                        <span className="text-xs font-semibold">{movie.rating}</span>
                      </div>
                    )}
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

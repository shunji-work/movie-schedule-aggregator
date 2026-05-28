import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, ExternalLink, MapPin, Plus, Star, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PosterImage } from '@/components/PosterImage';
import {
  addWatchedMovie,
  enrichMoviesWithExternalRatings,
  listMovieShowtimes,
  listMovies,
  sortMoviesByRating,
  type ShowtimeWithDetails,
} from '@/lib/app-data';
import { formatDistance } from '@/lib/geolocation';
import { getTheaterChainBorderColor, getTheaterChainColor } from '@/lib/theater-colors';
import { type Movie } from '@/lib/supabase';
import { useUserLocation } from '@/hooks/useUserLocation';

function formatShowtime(showtime: string) {
  return new Date(showtime).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Movies() {
  const { location } = useUserLocation();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<ShowtimeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState('all');

  useEffect(() => {
    let cancelled = false;

    listMovies()
      .then((items) => {
        if (!cancelled) {
          const sorted = sortMoviesByRating(items);
          setMovies(sorted);

          enrichMoviesWithExternalRatings(sorted).then((enriched) => {
            if (!cancelled) {
              setMovies(enriched);
              setSelectedMovie((current) =>
                current ? enriched.find((movie) => movie.id === current.id) ?? current : current
              );
            }
          });
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
  }, []);

  useEffect(() => {
    setSelectedVersion('all');
  }, [selectedMovie?.id]);

  useEffect(() => {
    if (!selectedMovie) {
      return;
    }

    if (!location) return;

    let cancelled = false;
    setDetailLoading(true);

    listMovieShowtimes(selectedMovie.id, location)
      .then((items) => {
        if (!cancelled) {
          setShowtimes(items);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location, selectedMovie]);

  const showtimeVersions = useMemo(
    () => [...new Set(showtimes.map((showtime) => showtime.movie_version ?? '\u901A\u5E38'))],
    [showtimes]
  );

  const visibleShowtimes = useMemo(() => {
    if (selectedVersion === 'all') {
      return showtimes;
    }

    return showtimes.filter(
      (showtime) => (showtime.movie_version ?? '\u901A\u5E38') === selectedVersion
    );
  }, [selectedVersion, showtimes]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        作品一覧を読み込み中です。
      </div>
    );
  }

  if (selectedMovie) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setSelectedMovie(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          作品一覧に戻る
        </Button>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="relative aspect-video w-full max-w-md overflow-hidden rounded-2xl bg-slate-200">
              <PosterImage
                src={selectedMovie.poster_urls ?? selectedMovie.poster_url}
                alt={selectedMovie.title}
                className="h-full w-full object-cover"
              />
              {selectedMovie.rating ? (
                <div className="absolute right-3 top-3 rounded-full bg-slate-950/85 px-3 py-1 text-sm font-semibold text-white shadow">
                  ★ {selectedMovie.rating.toFixed(1)}
                </div>
              ) : null}
            </div>
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-900">{selectedMovie.title}</h2>
                <p className="text-sm text-slate-500">
                  {selectedMovie.genre} ・ {selectedMovie.duration}分
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedMovie.rating ? (
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    <Star className="mr-1 h-3 w-3 fill-current text-amber-500" />
                    {selectedMovie.rating.toFixed(1)}
                    {selectedMovie.rating_source ? ` ${selectedMovie.rating_source}` : null}
                  </Badge>
                ) : null}
                {selectedMovie.rating_url ? (
                  <a
                    href={selectedMovie.rating_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                  >
                    評価を見る
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                ) : null}
                {selectedMovie.ranking ? (
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    注目度 {selectedMovie.ranking}位
                  </Badge>
                ) : null}
              </div>
              <Button
                onClick={() => addWatchedMovie(selectedMovie.id, showtimes[0]?.theater_id ?? null)}
              >
                <Plus className="mr-2 h-4 w-4" />
                観た映画として記録
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">今日の上映スケジュール</h3>
            <p className="text-sm text-slate-600">
              現在地に近い映画館から順に並べています。
            </p>
          </div>
          {showtimeVersions.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={selectedVersion === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedVersion('all')}
              >
                すべて
              </Button>
              {showtimeVersions.map((version) => (
                <Button
                  key={version}
                  size="sm"
                  variant={selectedVersion === version ? 'default' : 'outline'}
                  onClick={() => setSelectedVersion(version)}
                >
                  {version}
                </Button>
              ))}
            </div>
          ) : null}

          {detailLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              上映スケジュールを読み込み中です。
            </div>
          ) : showtimes.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              今日これから観られる上映が見つかりませんでした。
            </div>
          ) : (
            visibleShowtimes.map((showtime) => (
              <Card
                key={showtime.id}
                className={`overflow-hidden border-l-4 ${getTheaterChainBorderColor(
                  showtime.theater.chain
                )}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${getTheaterChainColor(showtime.theater.chain)} text-white`}>
                          {showtime.theater.chain}
                        </Badge>
                        <Badge variant="outline" className="border-slate-300 text-slate-700">
                          {showtime.movie_version ?? '通常'}
                        </Badge>
                        <span className="text-lg font-semibold text-slate-900">
                          {showtime.theater.name}
                        </span>
                      </div>
                      {showtime.raw_movie_title && showtime.raw_movie_title !== selectedMovie.title ? (
                        <p className="text-xs text-slate-500">{showtime.raw_movie_title}</p>
                      ) : null}
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
                          <span className="truncate">{showtime.theater.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{formatDistance(showtime.distance)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {showtime.booking_url ? (
                        <Button asChild>
                          <a href={showtime.booking_url} target="_blank" rel="noreferrer">
                            <Ticket className="mr-2 h-4 w-4" />
                            予約画面へ
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        onClick={() => addWatchedMovie(showtime.movie_id, showtime.theater_id)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        この上映を記録
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">作品一覧</h2>
        <p className="text-sm text-slate-600">
          作品を選ぶと、今日の上映を映画館横断で比較できます。
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {movies.map((movie) => (
          <Card
            key={movie.id}
            className="cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() => setSelectedMovie(movie)}
          >
            <CardContent className="p-0">
              <div className="relative aspect-video overflow-hidden bg-slate-200">
                <PosterImage
                  src={movie.poster_urls ?? movie.poster_url}
                  alt={movie.title}
                  className="h-full w-full object-cover"
                />
                {movie.rating ? (
                  <div className="absolute right-2 top-2 rounded-full bg-slate-950/85 px-2.5 py-1 text-xs font-semibold text-white shadow">
                    ★ {movie.rating.toFixed(1)}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-lg font-semibold text-slate-900">
                  {movie.title}
                </h3>
                <p className="text-sm text-slate-500">
                  {movie.genre} ・ {movie.duration}分
                </p>
                <div className="flex flex-wrap gap-2">
                  {movie.rating ? (
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      ★ {movie.rating.toFixed(1)}
                      {movie.rating_source ? ` ${movie.rating_source}` : null}
                    </Badge>
                  ) : null}
                  {movie.ranking ? (
                    <Badge variant="outline" className="border-slate-300 text-slate-700">
                      {movie.ranking}位
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

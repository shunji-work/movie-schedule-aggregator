import { useEffect, useState } from 'react';
import { ExternalLink, Heart, MapPin, Navigation, Popcorn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listTheatersWithMeta, toggleFavoriteTheater, type TheaterWithMeta } from '@/lib/app-data';
import { formatDistance } from '@/lib/geolocation';
import { getTheaterChainBorderColor, getTheaterChainColor } from '@/lib/theater-colors';
import { useUserLocation } from '@/hooks/useUserLocation';

function formatShowtime(showtime: string | null) {
  if (!showtime) {
    return '本日の上映なし';
  }

  return new Date(showtime).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Theaters() {
  const { location } = useUserLocation();
  const [theaters, setTheaters] = useState<TheaterWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) return;

    let cancelled = false;

    setLoading(true);
    listTheatersWithMeta(location)
      .then((items) => {
        if (!cancelled) {
          setTheaters(items);
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

  const handleToggleFavorite = (theaterId: string) => {
    const next = new Set(toggleFavoriteTheater(theaterId));
    setTheaters((current) =>
      current.map((theater) => ({
        ...theater,
        isFavorite: next.has(theater.id),
      }))
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">近くの映画館</h2>
        <p className="text-sm text-slate-600">
          現在地からの距離順で並べています。お気に入りに入れるとタイムラインに反映されます。
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          映画館情報を読み込み中です。
        </div>
      ) : (
        <div className="space-y-4">
          {theaters.map((theater) => {
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${theater.latitude},${theater.longitude}`;

            return (
              <Card
                key={theater.id}
                className={`overflow-hidden border-l-4 ${getTheaterChainBorderColor(
                  theater.chain
                )}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`${getTheaterChainColor(theater.chain)} text-white`}>
                          {theater.chain}
                        </Badge>
                        <h3 className="text-xl font-semibold text-slate-900">{theater.name}</h3>
                        {theater.isFavorite ? (
                          <Badge variant="outline" className="border-rose-200 text-rose-600">
                            お気に入り
                          </Badge>
                        ) : null}
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                        <div className="flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-slate-400" />
                          <span>{formatDistance(theater.distance)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Popcorn className="h-4 w-4 text-slate-400" />
                          <span>{theater.movieCount}作品を上映中</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>次回 {formatShowtime(theater.nextShowtime)}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
                        <span>{theater.address}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={theater.isFavorite ? 'default' : 'outline'}
                        onClick={() => handleToggleFavorite(theater.id)}
                      >
                        <Heart
                          className={`mr-2 h-4 w-4 ${
                            theater.isFavorite ? 'fill-current' : ''
                          }`}
                        />
                        {theater.isFavorite ? 'お気に入り解除' : 'お気に入り追加'}
                      </Button>
                      <Button asChild variant="outline">
                        <a href={mapUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          地図で開く
                        </a>
                      </Button>
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

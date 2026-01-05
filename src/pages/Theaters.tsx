import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Star, ExternalLink } from 'lucide-react';
import { supabase, type Theater } from '@/lib/supabase';
import { getTheaterChainColor, getTheaterChainBorderColor } from '@/lib/theater-colors';
import { calculateDistance, formatDistance, getMockLocation } from '@/lib/geolocation';

type TheaterWithDistance = Theater & {
  distance: number;
  isFavorite: boolean;
};

export function Theaters() {
  const [theaters, setTheaters] = useState<TheaterWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const location = getMockLocation();
    setUserLocation(location);
    loadTheaters();
  }, []);

  const loadTheaters = async () => {
    try {
      const userLocation = getMockLocation();

      const { data: theatersData, error: theatersError } = await supabase
        .from('theaters')
        .select('*');

      if (theatersError) throw theatersError;

      const { data: favoritesData } = await supabase
        .from('user_favorite_theaters')
        .select('theater_id');

      const favoriteIds = new Set(
        favoritesData?.map((f) => f.theater_id) || []
      );

      const theatersWithDistance = (theatersData || []).map((theater) => ({
        ...theater,
        distance: calculateDistance(userLocation, {
          latitude: theater.latitude,
          longitude: theater.longitude,
        }),
        isFavorite: favoriteIds.has(theater.id),
      }));

      theatersWithDistance.sort((a, b) => a.distance - b.distance);

      setTheaters(theatersWithDistance);
    } catch (error) {
      console.error('Error loading theaters:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (theaterId: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await supabase
          .from('user_favorite_theaters')
          .delete()
          .eq('theater_id', theaterId);
      } else {
        await supabase
          .from('user_favorite_theaters')
          .insert({ theater_id: theaterId });
      }

      setTheaters((prev) =>
        prev.map((t) =>
          t.id === theaterId ? { ...t, isFavorite: !isFavorite } : t
        )
      );
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-slate-600">読み込み中...</div>
      </div>
    );
  }

  const getMapUrl = () => {
    if (!userLocation || theaters.length === 0) return '';

    const query = [
      `${userLocation.latitude},${userLocation.longitude}`,
      ...theaters.map(t => `${t.latitude},${t.longitude}`)
    ].join('/');

    return `https://www.google.co.jp/maps/dir/${query}`;
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">劇場マップ</h2>
        <p className="text-slate-600">
          現在地から近い順に表示 / タップでマイシアターに登録
        </p>
      </div>

      {theaters.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          劇場データがありません
        </div>
      ) : (
        <>
          {userLocation && (
            <Card className="mb-6 overflow-hidden">
              <CardContent className="p-0">
                <div className="relative w-full h-96">
                  <iframe
                    src={`https://www.google.co.jp/maps?q=${userLocation.latitude},${userLocation.longitude}&z=12&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="劇場マップ"
                  />
                </div>
                <div className="p-4 bg-slate-50 border-t">
                  <a
                    href={getMapUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Google Mapsで全ての劇場を見る
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {theaters.map((theater) => {
              const colorClass = getTheaterChainColor(theater.chain);
              const borderClass = getTheaterChainBorderColor(theater.chain);
              const theaterMapUrl = `https://www.google.co.jp/maps/?q=${theater.latitude},${theater.longitude}`;

              return (
                <Card
                  key={theater.id}
                  className={`border-l-4 ${borderClass} ${
                    theater.isFavorite ? 'bg-slate-50' : ''
                  } hover:shadow-md transition-shadow`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${colorClass} text-white`}>
                            {theater.chain}
                          </Badge>
                          <span className="font-semibold text-slate-900 text-lg">
                            {theater.name}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{theater.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">現在地から</span>
                            <span className="font-semibold text-slate-900">
                              {formatDistance(theater.distance)}
                            </span>
                          </div>
                          <a
                            href={theaterMapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                          >
                            <MapPin className="w-3 h-3" />
                            地図で見る
                          </a>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant={theater.isFavorite ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleFavorite(theater.id, theater.isFavorite)}
                          className={
                            theater.isFavorite
                              ? 'bg-slate-900 hover:bg-slate-700'
                              : ''
                          }
                        >
                          <Star
                            className={`w-4 h-4 ${
                              theater.isFavorite ? 'fill-current' : ''
                            }`}
                          />
                          <span className="ml-1">
                            {theater.isFavorite ? '登録済み' : '登録'}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

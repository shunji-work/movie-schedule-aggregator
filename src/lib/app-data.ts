import {
  supabase,
  type Movie,
  type Showtime,
  type Theater,
  type UserWatchedMovie,
} from '@/lib/supabase';
import { calculateDistance, type Location } from '@/lib/geolocation';

export type ShowtimeWithDetails = Showtime & {
  movie: Movie;
  theater: Theater;
  distance?: number;
};

export type TheaterWithMeta = Theater & {
  distance: number;
  isFavorite: boolean;
  nextShowtime: string | null;
  movieCount: number;
};

export type WatchedMovieWithDetails = UserWatchedMovie & {
  movie: Movie;
  theater: Theater | null;
};

const FAVORITES_KEY = 'movie-schedule.favorite-theaters';
const WATCHED_KEY = 'movie-schedule.watched-movies';

export const isDemoMode = !supabase;

const DEMO_MOVIES: Movie[] = [
  {
    id: 'movie-1',
    title: 'Flow',
    poster_url:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
    duration: 85,
    genre: 'Animation',
    ranking: 1,
    rating: 4.4,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-2',
    title: 'Mickey 17',
    poster_url:
      'https://images.unsplash.com/photo-1517602302552-471fe67acf66?auto=format&fit=crop&w=600&q=80',
    duration: 137,
    genre: 'Sci-Fi',
    ranking: 2,
    rating: 4.1,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-3',
    title: 'Wicked',
    poster_url:
      'https://images.unsplash.com/photo-1513106580091-1d82408b8cd6?auto=format&fit=crop&w=600&q=80',
    duration: 161,
    genre: 'Musical',
    ranking: 4,
    rating: 4.3,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-4',
    title: 'The Brutalist',
    poster_url:
      'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80',
    duration: 215,
    genre: 'Drama',
    ranking: 7,
    rating: 4.2,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-5',
    title: 'Inside Out 2',
    poster_url:
      'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=600&q=80',
    duration: 96,
    genre: 'Family',
    ranking: 9,
    rating: 4.0,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-6',
    title: 'Perfect Days',
    poster_url:
      'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=80',
    duration: 124,
    genre: 'Drama',
    ranking: 12,
    rating: 4.5,
    created_at: '2026-03-01T00:00:00.000Z',
  },
];

const DEMO_THEATERS: Theater[] = [
  {
    id: 'theater-1',
    name: 'TOHOシネマズ 日比谷',
    chain: 'TOHO Cinemas',
    latitude: 35.6745,
    longitude: 139.7596,
    address: '東京都千代田区有楽町1-1-2 東京ミッドタウン日比谷',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-2',
    name: 'TOHOシネマズ 新宿',
    chain: 'TOHO Cinemas',
    latitude: 35.6942,
    longitude: 139.7031,
    address: '東京都新宿区歌舞伎町1-19-1 新宿東宝ビル3F',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-3',
    name: 'TOHOシネマズ 日本橋',
    chain: 'TOHO Cinemas',
    latitude: 35.6861,
    longitude: 139.7745,
    address: '東京都中央区日本橋室町2-3-1 コレド室町2 3F',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-4',
    name: 'TOHOシネマズ 六本木ヒルズ',
    chain: 'TOHO Cinemas',
    latitude: 35.6605,
    longitude: 139.7294,
    address: '東京都港区六本木6-10-2 六本木ヒルズけやき坂コンプレックス',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-5',
    name: 'TOHOシネマズ 上野',
    chain: 'TOHO Cinemas',
    latitude: 35.7112,
    longitude: 139.7742,
    address: '東京都台東区上野3-24-6 上野フロンティアタワー7F',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-6',
    name: 'TOHOシネマズ 錦糸町',
    chain: 'TOHO Cinemas',
    latitude: 35.6968,
    longitude: 139.8149,
    address: '東京都墨田区太平4-1-2 オリナスモール4F',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-7',
    name: 'TOHOシネマズ 池袋',
    chain: 'TOHO Cinemas',
    latitude: 35.7295,
    longitude: 139.7196,
    address: '東京都豊島区東池袋1-18-1 Hareza Tower内',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-8',
    name: 'TOHOシネマズ 渋谷',
    chain: 'TOHO Cinemas',
    latitude: 35.6598,
    longitude: 139.6996,
    address: '東京都渋谷区道玄坂2-6-17 渋東シネタワー',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-9',
    name: 'TOHOシネマズ 府中',
    chain: 'TOHO Cinemas',
    latitude: 35.6708,
    longitude: 139.4777,
    address: '東京都府中市宮町1-50 くるる5F',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-10',
    name: 'TOHOシネマズ 西新井',
    chain: 'TOHO Cinemas',
    latitude: 35.7785,
    longitude: 139.7902,
    address: '東京都足立区西新井栄町1-20-1 アリオ西新井4F',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-11',
    name: '109シネマズ二子玉川',
    chain: '109 Cinemas',
    latitude: 35.6117,
    longitude: 139.6274,
    address: '東京都世田谷区玉川1-14-1',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-12',
    name: 'ユナイテッド・シネマ豊洲',
    chain: 'United Cinemas',
    latitude: 35.655,
    longitude: 139.7957,
    address: '東京都江東区豊洲2-4-9',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-13',
    name: 'MOVIX亀有',
    chain: 'MOVIX',
    latitude: 35.7664,
    longitude: 139.8486,
    address: '東京都葛飾区亀有3-49-3',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-14',
    name: 'イオンシネマ板橋',
    chain: 'AEON Cinema',
    latitude: 35.7874,
    longitude: 139.6752,
    address: '東京都板橋区徳丸2-6-1',
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'theater-15',
    name: 'ヒューマントラストシネマ渋谷',
    chain: 'Humax Cinemas',
    latitude: 35.6597,
    longitude: 139.7016,
    address: '東京都渋谷区渋谷1-23-16',
    created_at: '2026-03-01T00:00:00.000Z',
  },
];

const SLOT_MINUTES = [20, 35, 50, 70, 85, 110, 140, 180, 230, 290, 360, 430];

function buildDemoShowtimes(base = new Date()): Showtime[] {
  const opening = new Date(base);
  opening.setSeconds(0, 0);

  const showtimes: Showtime[] = [];

  DEMO_MOVIES.forEach((movie, movieIndex) => {
    DEMO_THEATERS.forEach((theater, theaterIndex) => {
      const isToho = theater.chain === 'TOHO Cinemas';
      const shouldInclude =
        isToho || (movieIndex + theaterIndex) % 2 === 0 || theaterIndex < 3;

      if (!shouldInclude) {
        return;
      }

      const slot = SLOT_MINUTES[(movieIndex * 2 + theaterIndex) % SLOT_MINUTES.length];
      const secondSlot = slot + 160 + theaterIndex * 5;
      const thirdSlot = isToho ? secondSlot + 150 : null;

      [slot, secondSlot, thirdSlot].forEach((offset, index) => {
        if (offset === null) {
          return;
        }

        const showtime = new Date(opening.getTime() + offset * 60 * 1000);
        showtimes.push({
          id: `showtime-${movie.id}-${theater.id}-${index}`,
          theater_id: theater.id,
          movie_id: movie.id,
          showtime: showtime.toISOString(),
          screen: `${(theaterIndex % 4) + index + 1}`,
          created_at: opening.toISOString(),
        });
      });
    });
  });

  return showtimes.sort(
    (a, b) => new Date(a.showtime).getTime() - new Date(b.showtime).getTime()
  );
}

function getStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setStorageItem<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

async function fetchRemoteShowtimes(): Promise<ShowtimeWithDetails[] | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('showtimes')
    .select(`
      *,
      theater:theaters(*),
      movie:movies(*)
    `)
    .order('showtime', { ascending: true });

  if (error || !data?.length) {
    return null;
  }

  return data as ShowtimeWithDetails[];
}

async function fetchRemoteMovies(): Promise<Movie[] | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .order('ranking', { ascending: true });

  if (error || !data?.length) {
    return null;
  }

  return data as Movie[];
}

async function fetchRemoteTheaters(): Promise<Theater[] | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from('theaters').select('*');

  if (error || !data?.length) {
    return null;
  }

  return data as Theater[];
}

function getDemoShowtimesWithDetails(): ShowtimeWithDetails[] {
  const theaters = new Map(DEMO_THEATERS.map((theater) => [theater.id, theater]));
  const movies = new Map(DEMO_MOVIES.map((movie) => [movie.id, movie]));

  return buildDemoShowtimes().map((showtime) => ({
    ...showtime,
    theater: theaters.get(showtime.theater_id)!,
    movie: movies.get(showtime.movie_id)!,
  }));
}

export async function listShowtimesWithDetails(): Promise<ShowtimeWithDetails[]> {
  const remote = await fetchRemoteShowtimes();
  return remote ?? getDemoShowtimesWithDetails();
}

export async function listMovies(): Promise<Movie[]> {
  const remote = await fetchRemoteMovies();

  if (remote) {
    return remote;
  }

  return [...DEMO_MOVIES].sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999));
}

export async function listTheaters(): Promise<Theater[]> {
  const remote = await fetchRemoteTheaters();
  return remote ?? DEMO_THEATERS;
}

export function getFavoriteTheaterIds(): string[] {
  return getStorageItem<string[]>(FAVORITES_KEY, []);
}

export function isFavoriteTheater(theaterId: string): boolean {
  return getFavoriteTheaterIds().includes(theaterId);
}

export function toggleFavoriteTheater(theaterId: string): string[] {
  const current = getFavoriteTheaterIds();
  const next = current.includes(theaterId)
    ? current.filter((id) => id !== theaterId)
    : [...current, theaterId];

  setStorageItem(FAVORITES_KEY, next);
  return next;
}

export async function listQuickWatchShowtimes(
  location: Location
): Promise<ShowtimeWithDetails[]> {
  const now = Date.now();
  const from = now + 10 * 60 * 1000;
  const to = now + 90 * 60 * 1000;

  return (await listShowtimesWithDetails())
    .filter((item) => {
      const time = new Date(item.showtime).getTime();
      return time >= from && time <= to;
    })
    .map((item) => ({
      ...item,
      distance: calculateDistance(location, {
        latitude: item.theater.latitude,
        longitude: item.theater.longitude,
      }),
    }));
}

export async function listTimelineShowtimes(
  location: Location
): Promise<ShowtimeWithDetails[]> {
  const favoriteIds = new Set(getFavoriteTheaterIds());

  if (!favoriteIds.size) {
    return [];
  }

  const now = Date.now();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return (await listShowtimesWithDetails())
    .filter((item) => {
      const time = new Date(item.showtime).getTime();
      return (
        favoriteIds.has(item.theater_id) &&
        time >= now + 10 * 60 * 1000 &&
        time <= endOfDay.getTime()
      );
    })
    .map((item) => ({
      ...item,
      distance: calculateDistance(location, {
        latitude: item.theater.latitude,
        longitude: item.theater.longitude,
      }),
    }))
    .sort((a, b) => new Date(a.showtime).getTime() - new Date(b.showtime).getTime());
}

export async function listMovieShowtimes(
  movieId: string,
  location: Location
): Promise<ShowtimeWithDetails[]> {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return (await listShowtimesWithDetails())
    .filter((item) => {
      const time = new Date(item.showtime).getTime();
      return item.movie_id === movieId && time >= Date.now() && time <= endOfDay.getTime();
    })
    .map((item) => ({
      ...item,
      distance: calculateDistance(location, {
        latitude: item.theater.latitude,
        longitude: item.theater.longitude,
      }),
    }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

export async function listTheatersWithMeta(
  location: Location
): Promise<TheaterWithMeta[]> {
  const [theaters, showtimes] = await Promise.all([
    listTheaters(),
    listShowtimesWithDetails(),
  ]);

  const favoriteIds = new Set(getFavoriteTheaterIds());

  return theaters
    .map((theater) => {
      const theaterShowtimes = showtimes
        .filter((item) => item.theater_id === theater.id)
        .filter((item) => new Date(item.showtime).getTime() >= Date.now());

      return {
        ...theater,
        distance: calculateDistance(location, {
          latitude: theater.latitude,
          longitude: theater.longitude,
        }),
        isFavorite: favoriteIds.has(theater.id),
        nextShowtime: theaterShowtimes[0]?.showtime ?? null,
        movieCount: new Set(theaterShowtimes.map((item) => item.movie_id)).size,
      };
    })
    .sort((a, b) => a.distance - b.distance);
}

export function addWatchedMovie(movieId: string, theaterId: string | null) {
  const watched = getStorageItem<UserWatchedMovie[]>(WATCHED_KEY, []);
  const now = new Date().toISOString();

  const record: UserWatchedMovie = {
    id: `watched-${Date.now()}`,
    user_id: 'local-user',
    movie_id: movieId,
    theater_id: theaterId,
    watched_at: now,
    memo: '',
    created_at: now,
  };

  setStorageItem(WATCHED_KEY, [record, ...watched]);
}

export function updateWatchedMovieMemo(id: string, memo: string) {
  const watched = getStorageItem<UserWatchedMovie[]>(WATCHED_KEY, []);
  const next = watched.map((item) => (item.id === id ? { ...item, memo } : item));
  setStorageItem(WATCHED_KEY, next);
}

export async function listWatchedMovies(): Promise<WatchedMovieWithDetails[]> {
  const watched = getStorageItem<UserWatchedMovie[]>(WATCHED_KEY, []);
  const [movies, theaters] = await Promise.all([listMovies(), listTheaters()]);

  const movieMap = new Map(movies.map((movie) => [movie.id, movie]));
  const theaterMap = new Map(theaters.map((theater) => [theater.id, theater]));

  return watched
    .map((item) => ({
      ...item,
      movie: movieMap.get(item.movie_id),
      theater: item.theater_id ? theaterMap.get(item.theater_id) ?? null : null,
    }))
    .filter((item): item is WatchedMovieWithDetails => Boolean(item.movie))
    .sort((a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime());
}

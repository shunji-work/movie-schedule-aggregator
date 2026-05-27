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
  distance: number | null;
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
export const LIVE_SCHEDULES_TIMEOUT_MS = 75_000;
export const LIVE_TOHO_FALLBACK_TIMEOUT_MS = 15_000;
const FALLBACK_THEATER_LOCATION = {
  latitude: 35.681236,
  longitude: 139.767125,
};

export const isDemoMode = !supabase;

type LiveCollectorMovie = {
  provider?: string;
  providerMovieCode: string;
  title: string;
  englishTitle: string | null;
  durationMinutes: number;
  ratingCode: string | null;
  isNew: boolean;
  posterUrl: string;
  theaterCode: string;
};

type LiveCollectorTheater = {
  code: string;
  name: string;
  englishName: string;
  provider: string;
  chain?: string;
  scheduleUrl: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
};

type LiveCollectorShowtime = {
  provider: string;
  theaterCode: string;
  theaterName: string;
  movieCode: string;
  movieTitle: string;
  screenCode: string;
  screenName: string;
  startsAt: string;
  endsAt: string;
  seatStatus: string | null;
  isLateShow: boolean;
  bookingCode: string | number;
  bookingUrl?: string;
};

type LiveCollectorSnapshot = {
  provider?: string;
  chain?: string;
  theaters: LiveCollectorTheater[];
  movies: LiveCollectorMovie[];
  showtimes: LiveCollectorShowtime[];
  errors?: Array<{ provider: string; message: string; theaterCode?: string }>;
};

let liveSnapshotPromise:
  | Promise<{
      movies: Movie[];
      theaters: Theater[];
      showtimes: ShowtimeWithDetails[];
    } | null>
  | null = null;

function getTokyoDateString() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeMovieTitleForPoster(title: string) {
  return title
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, '')
    .replace(/\([^)]*$/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/（[^）]*$/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function pushUnique(target: string[], value: string) {
  if (value && !target.includes(value)) {
    target.push(value);
  }
}

function buildPosterCandidateMap(
  movies: LiveCollectorMovie[],
  getProviderForMovie: (movie: LiveCollectorMovie) => string
) {
  const candidatesByTitle = new Map<string, string[]>();

  for (const movie of movies) {
    const key = normalizeMovieTitleForPoster(movie.title);
    const candidates = candidatesByTitle.get(key) ?? [];
    pushUnique(candidates, movie.posterUrl);
    candidatesByTitle.set(key, candidates);
  }

  const candidatesByCode = new Map<string, string[]>();

  for (const movie of movies) {
    const ownCandidates: string[] = [];
    pushUnique(ownCandidates, movie.posterUrl);

    for (const candidate of candidatesByTitle.get(normalizeMovieTitleForPoster(movie.title)) ?? []) {
      pushUnique(ownCandidates, candidate);
    }

    candidatesByCode.set(
      `${getProviderForMovie(movie)}:${movie.providerMovieCode}`,
      ownCandidates
    );
  }

  return candidatesByCode;
}

function getProviderChain(provider: string, fallback?: string) {
  if (fallback) {
    return fallback;
  }

  const labels: Record<string, string> = {
    toho: 'TOHO Cinemas',
    aeon: 'AEON Cinema',
    united: 'United Cinemas',
    '109': '109 Cinemas',
    smt: 'MOVIX / Piccadilly',
    tjoy: 'T-Joy',
  };

  return labels[provider] ?? provider;
}

function buildSourceKey(provider: string, code: string) {
  return `${provider}:${code}`;
}

function buildLiveId(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80);
}

export function hasKnownTheaterLocation(
  theater: Pick<Theater, 'latitude' | 'longitude' | 'has_location'>
) {
  if (theater.has_location === false) {
    return false;
  }

  return Number.isFinite(theater.latitude) && Number.isFinite(theater.longitude);
}

function getTheaterDistance(location: Location, theater: Theater) {
  if (!hasKnownTheaterLocation(theater)) {
    return null;
  }

  return calculateDistance(location, {
    latitude: theater.latitude,
    longitude: theater.longitude,
  });
}

function compareDistance(a: number | null | undefined, b: number | null | undefined) {
  return (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
}

export function normalizeLiveSnapshot(snapshot: LiveCollectorSnapshot) {
  const theaterMap = new Map<string, Theater>();
  const movieMap = new Map<string, Movie>();
  const theaterProviderByCode = new Map(
    snapshot.theaters.map((theater) => [theater.code, theater.provider])
  );
  const posterCandidatesByCode = buildPosterCandidateMap(
    snapshot.movies,
    (movie) =>
      movie.provider ??
      theaterProviderByCode.get(movie.theaterCode) ??
      snapshot.provider ??
      'toho'
  );
  const movieTitleKeyBySource = new Map<string, string>();
  const sourceMovieMap = new Map<string, LiveCollectorMovie>();

  for (const theater of snapshot.theaters) {
    const provider = theater.provider || snapshot.provider || 'toho';
    const hasLocation =
      typeof theater.latitude === 'number' &&
      Number.isFinite(theater.latitude) &&
      typeof theater.longitude === 'number' &&
      Number.isFinite(theater.longitude);

    theaterMap.set(buildSourceKey(provider, theater.code), {
      id: `${provider}-theater-${theater.code}`,
      name: theater.name,
      chain: getProviderChain(provider, theater.chain ?? snapshot.chain),
      latitude: hasLocation ? theater.latitude! : FALLBACK_THEATER_LOCATION.latitude,
      longitude: hasLocation ? theater.longitude! : FALLBACK_THEATER_LOCATION.longitude,
      has_location: hasLocation,
      address: theater.address || theater.name,
      created_at: new Date().toISOString(),
    });
  }

  const movieShowtimeCounts = new Map<string, number>();
  for (const showtime of snapshot.showtimes) {
    const titleKey =
      normalizeMovieTitleForPoster(showtime.movieTitle) ||
      buildSourceKey(showtime.provider, showtime.movieCode);
    movieShowtimeCounts.set(
      titleKey,
      (movieShowtimeCounts.get(titleKey) ?? 0) + 1
    );
  }

  for (const movie of snapshot.movies) {
    const provider =
      movie.provider ??
      theaterProviderByCode.get(movie.theaterCode) ??
      snapshot.provider ??
      'toho';
    const sourceKey = buildSourceKey(provider, movie.providerMovieCode);
    const titleKey = normalizeMovieTitleForPoster(movie.title) || sourceKey;
    sourceMovieMap.set(sourceKey, movie);
    movieTitleKeyBySource.set(sourceKey, titleKey);

    if (movieMap.has(titleKey)) {
      continue;
    }

    movieMap.set(titleKey, {
      id: `live-movie-${buildLiveId(titleKey) || movie.providerMovieCode}`,
      title: movie.title,
      poster_url: movie.posterUrl,
      poster_urls: posterCandidatesByCode.get(sourceKey),
      duration: movie.durationMinutes,
      genre: movie.englishTitle || 'Movie',
      ranking: undefined,
      rating: undefined,
      created_at: new Date().toISOString(),
    });
  }

  for (const showtime of snapshot.showtimes) {
    const sourceKey = buildSourceKey(showtime.provider, showtime.movieCode);
    const titleKey =
      (movieTitleKeyBySource.get(sourceKey) ??
        normalizeMovieTitleForPoster(showtime.movieTitle)) ||
      sourceKey;

    if (movieMap.has(titleKey)) {
      continue;
    }

    const sourceMovie = sourceMovieMap.get(sourceKey);
    movieMap.set(titleKey, {
      id: `live-movie-${buildLiveId(titleKey) || showtime.movieCode}`,
      title: sourceMovie?.title || showtime.movieTitle,
      poster_url: sourceMovie?.posterUrl || '',
      poster_urls: sourceMovie
        ? posterCandidatesByCode.get(sourceKey)
        : undefined,
      duration: sourceMovie?.durationMinutes || 0,
      genre: sourceMovie?.englishTitle || 'Movie',
      ranking: undefined,
      rating: undefined,
      created_at: new Date().toISOString(),
    });
  }

  const movieShowtimeCountById = new Map(
    [...movieMap.entries()].map(([titleKey, movie]) => [
      movie.id,
      movieShowtimeCounts.get(titleKey) ?? 0,
    ])
  );
  const movies = [...movieMap.values()].sort(
    (a, b) => (movieShowtimeCountById.get(b.id) ?? 0) - (movieShowtimeCountById.get(a.id) ?? 0)
  );

  const movieByTitleKey = new Map(
    [...movieMap.entries()].map(([titleKey, movie]) => [titleKey, movie])
  );

  const showtimes = snapshot.showtimes
    .map((showtime) => {
      const sourceKey = buildSourceKey(showtime.provider, showtime.movieCode);
      const titleKey =
        (movieTitleKeyBySource.get(sourceKey) ??
          normalizeMovieTitleForPoster(showtime.movieTitle)) ||
        sourceKey;
      const movie = movieByTitleKey.get(titleKey);
      const theater = theaterMap.get(buildSourceKey(showtime.provider, showtime.theaterCode));

      if (!movie || !theater) {
        return null;
      }

      return {
        id: `${showtime.provider}-showtime-${showtime.theaterCode}-${showtime.movieCode}-${showtime.screenCode}-${showtime.bookingCode}-${showtime.startsAt}`,
        theater_id: theater.id,
        movie_id: movie.id,
        showtime: showtime.startsAt,
        screen: showtime.screenName || showtime.screenCode,
        created_at: new Date().toISOString(),
        movie,
        theater,
      } satisfies ShowtimeWithDetails;
    })
    .filter((item): item is ShowtimeWithDetails => Boolean(item));

  return {
    movies,
    theaters: [...theaterMap.values()],
    showtimes,
  };
}

async function fetchLiveSnapshotEndpoint(endpoint: string, date: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${endpoint}?date=${date}`, {
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as LiveCollectorSnapshot;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchLiveSnapshot() {
  if (typeof window === 'undefined') {
    return null;
  }

  const date = getTokyoDateString();
  const endpoints = [
    { path: '/api/schedules', timeoutMs: LIVE_SCHEDULES_TIMEOUT_MS },
    { path: '/api/toho', timeoutMs: LIVE_TOHO_FALLBACK_TIMEOUT_MS },
  ];

  for (const endpoint of endpoints) {
    try {
      const snapshot = await fetchLiveSnapshotEndpoint(endpoint.path, date, endpoint.timeoutMs);

      if (!snapshot) {
        continue;
      }

      const normalized = normalizeLiveSnapshot(snapshot);

      if (normalized.showtimes.length || normalized.theaters.length) {
        return normalized;
      }
    } catch {
      // Try the compatibility endpoint before falling back to Supabase/demo data.
    }
  }

  return null;
}

async function getLiveSnapshot() {
  if (!liveSnapshotPromise) {
    liveSnapshotPromise = fetchLiveSnapshot().then((snapshot) => {
      if (!snapshot) {
        liveSnapshotPromise = null;
      }

      return snapshot;
    });
  }

  return liveSnapshotPromise;
}

const DEMO_MOVIES: Movie[] = [
  {
    id: 'movie-1',
    title: 'ゴールデンカムイ 網走監獄襲撃編',
    poster_url:
      'https://hlo.tohotheater.jp/images_net/movie/027888/SAKUHIN027888_1.jpg',
    duration: 122,
    genre: 'Action',
    ranking: 1,
    rating: 4.4,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-2',
    title: 'ウィキッド 永遠の約束',
    poster_url:
      'https://hlo.tohotheater.jp/images_net/movie/026954/SAKUHIN026954_1.jpg',
    duration: 137,
    genre: 'Musical',
    ranking: 2,
    rating: 4.1,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-3',
    title: '私がビーバーになる時',
    poster_url:
      'https://hlo.tohotheater.jp/images_net/movie/027890/SAKUHIN027890_1.jpg',
    duration: 104,
    genre: 'Animation',
    ranking: 4,
    rating: 4.3,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-4',
    title: '映画ドラえもん 新・のび太の海底鬼岩城',
    poster_url:
      'https://hlo.tohotheater.jp/images_net/movie/027812/SAKUHIN027812_1.jpg',
    duration: 102,
    genre: 'Family',
    ranking: 7,
    rating: 4.2,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-5',
    title: '劇場版 鬼滅の刃 無限城編 第一章 猗窩座再来',
    poster_url:
      'https://hlo.tohotheater.jp/images_net/movie/026079/SAKUHIN026079_1.jpg',
    duration: 155,
    genre: 'Anime',
    ranking: 9,
    rating: 4.0,
    created_at: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'movie-6',
    title: '国宝',
    poster_url:
      'https://hlo.tohotheater.jp/images_net/movie/026192/SAKUHIN026192_1.jpg',
    duration: 175,
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
  const live = await getLiveSnapshot();
  if (live?.showtimes.length) {
    return live.showtimes;
  }

  const remote = await fetchRemoteShowtimes();
  return remote ?? getDemoShowtimesWithDetails();
}

export async function listMovies(): Promise<Movie[]> {
  const live = await getLiveSnapshot();
  if (live?.movies.length) {
    return live.movies;
  }

  const remote = await fetchRemoteMovies();

  if (remote) {
    return remote;
  }

  return [...DEMO_MOVIES].sort((a, b) => (a.ranking ?? 999) - (b.ranking ?? 999));
}

export async function listTheaters(): Promise<Theater[]> {
  const live = await getLiveSnapshot();
  if (live?.theaters.length) {
    return live.theaters;
  }

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
      distance: getTheaterDistance(location, item.theater) ?? undefined,
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
      distance: getTheaterDistance(location, item.theater) ?? undefined,
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
      distance: getTheaterDistance(location, item.theater) ?? undefined,
    }))
    .sort((a, b) => compareDistance(a.distance, b.distance));
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
        distance: getTheaterDistance(location, theater),
        isFavorite: favoriteIds.has(theater.id),
        nextShowtime: theaterShowtimes[0]?.showtime ?? null,
        movieCount: new Set(theaterShowtimes.map((item) => item.movie_id)).size,
      };
    })
    .sort((a, b) => compareDistance(a.distance, b.distance));
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

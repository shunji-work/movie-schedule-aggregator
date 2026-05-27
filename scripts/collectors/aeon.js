import {
  absoluteUrl,
  buildJstDateTime,
  createEmptySnapshot,
  durationTextToMinutes,
  fetchJson,
  fetchText,
  fromYmd,
  isoUtcToJst,
  mapLimit,
  normalizeWhitespace,
  PROVIDER_CHAINS,
  stableCode,
  toYmd,
  uniqueBy,
} from './shared.js';

const AEON_THEATER_LIST_URL = 'https://www.aeoncinema.com/theater/';
const AEON_THEATER_BASE_URL = 'https://theater.aeoncinema.com/theaters';
const AEON_SCHEDULE_DATA_BASE = 'https://theater.aeoncinema.com/schedule/v2/data';
const AEON_MOVIE_MASTER_URL =
  'https://theater.aeoncinema.com/schedule/v2/data/__master/movies.json';

function buildAeonTheaterUrl(alias) {
  return `${AEON_THEATER_BASE_URL}/${alias}/`;
}

export function buildAeonScheduleJsonUrl(alias) {
  return `${AEON_SCHEDULE_DATA_BASE}/${alias}/schedule.json`;
}

export function parseAeonTheaterList(html) {
  const theaters = [];
  const regex = /<a\b[^>]+href=["'](?:https:\/\/www\.aeoncinema\.com)?\/cinema\/([^/"'?#]+)\/?["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const code = match[1];
    const name = normalizeWhitespace(match[2]);

    if (!code || !name || code === 'app' || code === 'cinema-haisin') {
      continue;
    }

    theaters.push({
      code,
      name: name.replace(/\s*\d+月\d+日.*$/, ''),
      englishName: '',
      provider: 'aeon',
      chain: PROVIDER_CHAINS.aeon,
      scheduleUrl: buildAeonTheaterUrl(code),
    });
  }

  return uniqueBy(theaters, (theater) => theater.code);
}

export function parseAeonTheaterPage(html) {
  const name =
    normalizeWhitespace(
      html.match(/<div class="fac-header__facilityname">[\s\S]*?<h2>([\s\S]*?)<\/h2>/i)?.[1] ??
        ''
    ) || null;
  const address = normalizeWhitespace(
    html.match(/<div class="fac-info2__address">[\s\S]*?<div class="fac-info2__detail">\s*<p>([\s\S]*?)<\/p>/i)?.[1] ??
      ''
  );

  return {
    name,
    address,
    latitude: null,
    longitude: null,
  };
}

function getMovieMaster(moviesMaster, identifier) {
  if (!moviesMaster || !identifier) {
    return null;
  }

  return moviesMaster[identifier] ?? null;
}

export function parseAeonScheduleResponse(payload, moviesMaster, theater, requestedDate) {
  const day = payload?.[toYmd(requestedDate)] ?? {};
  const movies = new Map();
  const showtimes = [];

  for (const events of Object.values(day)) {
    for (const event of events ?? []) {
      const movieCode =
        event.superEvent?.workPerformed?.identifier ??
        event.superEvent?.id ??
        event.id ??
        stableCode(event.name?.ja ?? event.name?.en ?? '');
      const master = getMovieMaster(moviesMaster, movieCode);
      const title =
        event.superEvent?.name?.ja ??
        event.name?.ja ??
        master?.name?.ja ??
        event.superEvent?.name?.en ??
        event.name?.en ??
        movieCode;

      if (!movies.has(movieCode)) {
        movies.set(movieCode, {
          provider: 'aeon',
          providerMovieCode: movieCode,
          title,
          englishTitle: master?.name?.en ?? event.superEvent?.name?.en ?? event.name?.en ?? null,
          durationMinutes: durationTextToMinutes(master?.duration ?? ''),
          ratingCode: master?.contentRating ?? null,
          isNew: false,
          posterUrl: master?.thumbnailUrl ?? '',
        });
      }

      const start = event.startDate ? isoUtcToJst(event.startDate) : buildJstDateTime(requestedDate, '00:00');
      const end = event.endDate ? isoUtcToJst(event.endDate) : start;
      const screenCode = event.location?.branchCode ?? '';
      const screenName = event.location?.name?.ja ?? screenCode;
      const remaining = event.remainingAttendeeCapacity;
      const maximum = event.maximumAttendeeCapacity;

      showtimes.push({
        provider: 'aeon',
        theaterCode: theater.code,
        theaterName: theater.name,
        movieCode,
        movieTitle: title,
        screenCode,
        screenName,
        startsAt: start,
        endsAt: end,
        seatStatus:
          Number.isFinite(remaining) && Number.isFinite(maximum)
            ? `${remaining}/${maximum}`
            : null,
        isLateShow: false,
        bookingCode: event.id ?? `${movieCode}-${screenCode}-${start}`,
        bookingUrl: `${theater.scheduleUrl}?date=${toYmd(requestedDate)}`,
      });
    }
  }

  return {
    theater: {
      code: theater.code,
      name: theater.name,
      provider: 'aeon',
      chain: PROVIDER_CHAINS.aeon,
    },
    movies: [...movies.values()],
    showtimes,
  };
}

export async function fetchAeonTheaters(fetchImpl = fetch) {
  const html = await fetchText(AEON_THEATER_LIST_URL, fetchImpl);
  return parseAeonTheaterList(html);
}

export async function fetchAeonTheaterMetadata(theater, fetchImpl = fetch) {
  const html = await fetchText(buildAeonTheaterUrl(theater.code), fetchImpl);
  const parsed = parseAeonTheaterPage(html);

  return {
    name: parsed.name ?? theater.name,
    address: parsed.address,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  };
}

export async function fetchAeonSchedule(theater, date, moviesMaster, fetchImpl = fetch) {
  const payload = await fetchJson(buildAeonScheduleJsonUrl(theater.code), fetchImpl);
  return parseAeonScheduleResponse(payload, moviesMaster, theater, date);
}

export async function collectAeonSchedules(
  { date, theaterCodes } = {},
  fetchImpl = fetch
) {
  const targetDate = date ?? fromYmd(toYmd(new Date().toISOString().slice(0, 10)));
  const snapshot = createEmptySnapshot('aeon', targetDate);
  const theaters = await fetchAeonTheaters(fetchImpl);
  const selectedTheaters = theaterCodes?.length
    ? theaters.filter((theater) => theaterCodes.includes(theater.code))
    : theaters;
  const moviesMaster = await fetchJson(AEON_MOVIE_MASTER_URL, fetchImpl).catch(() => ({}));

  const collected = await mapLimit(selectedTheaters, 4, async (theater) => {
    try {
      const metadata = await fetchAeonTheaterMetadata(theater, fetchImpl).catch(() => ({
        name: theater.name,
        address: '',
        latitude: null,
        longitude: null,
      }));
      const hydratedTheater = {
        ...theater,
        ...metadata,
        scheduleUrl: absoluteUrl(theater.scheduleUrl, AEON_THEATER_LIST_URL),
      };
      const schedule = await fetchAeonSchedule(hydratedTheater, targetDate, moviesMaster, fetchImpl);

      return {
        ...hydratedTheater,
        movies: schedule.movies,
        showtimes: schedule.showtimes,
      };
    } catch (error) {
      snapshot.errors ??= [];
      snapshot.errors.push({
        provider: 'aeon',
        theaterCode: theater.code,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        ...theater,
        latitude: null,
        longitude: null,
        address: '',
        movies: [],
        showtimes: [],
      };
    }
  });

  return {
    ...snapshot,
    theaters: collected.map(({ movies, showtimes, ...theater }) => theater),
    movies: collected.flatMap((theater) =>
      theater.movies.map((movie) => ({
        ...movie,
        theaterCode: theater.code,
      }))
    ),
    showtimes: collected.flatMap((theater) => theater.showtimes),
  };
}

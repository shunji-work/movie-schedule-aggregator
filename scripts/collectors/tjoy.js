import {
  absoluteUrl,
  buildJstDateTime,
  createEmptySnapshot,
  durationTextToMinutes,
  fetchText,
  mapLimit,
  normalizeWhitespace,
  PROVIDER_CHAINS,
  stableCode,
  uniqueBy,
} from './shared.js';

const TJOY_COMPANY_THEATER_URL = 'https://tjoy.co.jp/theater';
const TJOY_BASE_URL = 'https://tjoy.jp';

export function buildTjoyScheduleUrl(theaterCode, date) {
  const url = new URL(`${TJOY_BASE_URL}/${theaterCode}`);
  url.searchParams.set('date', date);
  return url.toString();
}

export function parseTjoyTheaterList(html) {
  const theaters = [];
  const regex = /<a\b[^>]+href=["']\/theater\/info\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const infoCode = match[1];
    const name = normalizeWhitespace(match[2]);

    if (!name) {
      continue;
    }

    theaters.push({
      code: infoCode,
      infoCode,
      siteCode: '',
      name,
      englishName: '',
      provider: 'tjoy',
      chain: PROVIDER_CHAINS.tjoy,
      scheduleUrl: `${TJOY_BASE_URL}/${infoCode}`,
    });
  }

  return uniqueBy(theaters, (theater) => theater.infoCode);
}

export function parseTjoyInfoPage(html, theater) {
  const scheduleUrl = html.match(/href=["'](https:\/\/tjoy\.jp\/([^"'/]+))["'][^>]*>\s*https:\/\/tjoy\.jp\//i)?.[1] ?? '';
  const siteCode = scheduleUrl.match(/tjoy\.jp\/([^/?#]+)/)?.[1] ?? theater.siteCode ?? theater.infoCode;
  const address = normalizeWhitespace(
    html.match(/<a\b[^>]+href=["']https:\/\/tjoy\.jp\/[^"']+["'][^>]*>[\s\S]*?<\/a>\s*<br\s*\/?>?\s*([\s\S]*?)<br/i)?.[1] ??
      ''
  );

  return {
    ...theater,
    code: siteCode,
    siteCode,
    scheduleUrl: scheduleUrl || `${TJOY_BASE_URL}/${siteCode}`,
    address,
    latitude: null,
    longitude: null,
  };
}

function cleanTjoyTitle(value) {
  return normalizeWhitespace(value);
}

export function parseTjoyScheduleHtml(html, theater, requestedDate) {
  const movies = new Map();
  const showtimes = [];
  const activeDate =
    html.match(/calendar-active["'][^>]+data-date=["']([^"']+)/i)?.[1] ??
    requestedDate;
  const filmBlocks = html.match(/<section class="section-container bg-white">[\s\S]*?(?=<section class="section-container bg-white">|<\/div>\s*<\/section>\s*<\/div>\s*<div class="modal|$)/gi) ?? [];

  for (const film of filmBlocks) {
    const title = cleanTjoyTitle(film.match(/<h5 class="js-title-film[^"]*">([\s\S]*?)<\/h5>/i)?.[1] ?? '');

    if (!title) {
      continue;
    }

    const movieCode =
      film.match(/id=["']film-([^"']+)/i)?.[1] ??
      film.match(/cinema_detail\/([^"']+)/i)?.[1] ??
      stableCode(title);
    const durationMinutes = durationTextToMinutes(film);
    const posterUrl = absoluteUrl(
      film.match(/<div class="align-self-start film-img">[\s\S]*?<img\b[^>]+src=["']([^"']*)/i)?.[1] ?? '',
      TJOY_BASE_URL
    );

    if (!movies.has(movieCode)) {
      movies.set(movieCode, {
        provider: 'tjoy',
        providerMovieCode: movieCode,
        title,
        englishTitle: null,
        durationMinutes,
        ratingCode: null,
        isNew: false,
        posterUrl,
      });
    }

    const scheduleBoxes = film.match(/<li class="schedule-box[\s\S]*?<\/li>/gi) ?? [];

    for (const box of scheduleBoxes) {
      const screenName = normalizeWhitespace(box.match(/<div class="theater-name[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
      const screenCode = screenName.normalize('NFKC').match(/\d+/)?.[0] ?? stableCode(screenName || title);
      const timeMatch = box.match(/<p class="schedule-time[^"]*">\s*([^<]+)\s*<span>\s*(?:～|~)\s*([^<]+)<\/span>/i);

      if (!timeMatch) {
        continue;
      }

      const startsAt = buildJstDateTime(activeDate, normalizeWhitespace(timeMatch[1]));

      showtimes.push({
        provider: 'tjoy',
        theaterCode: theater.code,
        theaterName: theater.name,
        movieCode,
        movieTitle: title,
        screenCode,
        screenName,
        startsAt,
        endsAt: buildJstDateTime(activeDate, normalizeWhitespace(timeMatch[2])),
        seatStatus: normalizeWhitespace(box.match(/<p[^>]+class="schedule-status[^"]*"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '') || null,
        isLateShow: /late|レイト/i.test(box),
        bookingCode: box.match(/reservation\/index\/([^"'/]+)/i)?.[1] ?? `${movieCode}-${screenCode}-${startsAt}`,
        bookingUrl: absoluteUrl(box.match(/location\.href\s*=\s*'([^']+)'/i)?.[1] ?? '', TJOY_BASE_URL),
      });
    }
  }

  return {
    theater: {
      code: theater.code,
      name: theater.name,
      provider: 'tjoy',
      chain: PROVIDER_CHAINS.tjoy,
    },
    movies: [...movies.values()],
    showtimes,
  };
}

export async function fetchTjoyTheaters(fetchImpl = fetch) {
  const html = await fetchText(TJOY_COMPANY_THEATER_URL, fetchImpl);
  return parseTjoyTheaterList(html);
}

export async function fetchTjoyTheaterMetadata(theater, fetchImpl = fetch) {
  const html = await fetchText(`https://tjoy.co.jp/theater/info/${theater.infoCode}`, fetchImpl);
  return parseTjoyInfoPage(html, theater);
}

export async function fetchTjoySchedule(theater, date, fetchImpl = fetch) {
  const html = await fetchText(buildTjoyScheduleUrl(theater.code, date), fetchImpl);
  return parseTjoyScheduleHtml(html, theater, date);
}

export async function collectTjoySchedules(
  { date, theaterCodes } = {},
  fetchImpl = fetch
) {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const snapshot = createEmptySnapshot('tjoy', targetDate);
  const theaters = await fetchTjoyTheaters(fetchImpl);
  const selectedTheaters = theaterCodes?.length
    ? theaters.filter((theater) => theaterCodes.includes(theater.code) || theaterCodes.includes(theater.infoCode))
    : theaters;

  const collected = await mapLimit(selectedTheaters, 4, async (theater) => {
    try {
      const metadata = await fetchTjoyTheaterMetadata(theater, fetchImpl);
      const schedule = await fetchTjoySchedule(metadata, targetDate, fetchImpl);

      return {
        ...metadata,
        movies: schedule.movies,
        showtimes: schedule.showtimes,
      };
    } catch (error) {
      snapshot.errors ??= [];
      snapshot.errors.push({
        provider: 'tjoy',
        theaterCode: theater.code,
        message: error instanceof Error ? error.message : String(error),
      });
      return {
        ...theater,
        address: '',
        latitude: null,
        longitude: null,
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

import {
  absoluteUrl,
  buildJstDateTime,
  createEmptySnapshot,
  durationTextToMinutes,
  fetchText,
  getAttr,
  mapLimit,
  normalizeWhitespace,
  PROVIDER_CHAINS,
  stableCode,
  uniqueBy,
} from './shared.js';

const UNITED_BASE_URL = 'https://www.unitedcinemas.jp';
const UNITED_THEATER_LIST_URL = `${UNITED_BASE_URL}/index.html`;
const UNITED_NON_THEATER_CODES = new Set([
  'about_company',
  'all',
  '4dx',
  'clubspice',
  'dakko_de_cinema',
  'distribution',
  'faq',
  'guidance',
  'imax',
  'produce',
  'property',
  'screenx',
  'screen_propose',
  'screen_rental',
  'sitemap',
  'spice',
]);

export function buildUnitedScheduleUrl(theaterCode, date) {
  const url = new URL(`${UNITED_BASE_URL}/${theaterCode}/daily.php`);
  url.searchParams.set('date', date);
  return url.toString();
}

export function parseUnitedTheaterList(html) {
  const theaters = [];
  const regex = /<a\b[^>]+href=["']\/([a-z0-9-]+)\/(?:index\.html)?["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const code = match[1];
    if (UNITED_NON_THEATER_CODES.has(code)) {
      continue;
    }

    const label = normalizeWhitespace(match[2]) || code;
    theaters.push({
      code,
      name: label,
      englishName: '',
      provider: 'united',
      chain: PROVIDER_CHAINS.united,
      scheduleUrl: `${UNITED_BASE_URL}/${code}/daily.php`,
    });
  }

  return uniqueBy(theaters, (theater) => theater.code);
}

export function parseUnitedTheaterMetadata(html, fallbackName = '') {
  const title = normalizeWhitespace(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const name =
    title.match(/^(.+?)\s+映画\s+スケジュール/)?.[1] ??
    title.match(/^(.+?)\s*\|/)?.[1] ??
    fallbackName;
  const mapHref = html.match(/href=["']([^"']*google\.[^"']*maps[^"']*)["']/i)?.[1] ?? '';
  const mapMatch =
    mapHref.match(/@(?<lat>-?\d+\.\d+),(?<lng>-?\d+\.\d+)/) ??
    mapHref.match(/!3d(?<lat>-?\d+\.\d+)!4d(?<lng>-?\d+\.\d+)/);

  return {
    name: normalizeWhitespace(name),
    address: normalizeWhitespace(
      html.match(/<p[^>]*class=["']address["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ''
    ),
    latitude: mapMatch?.groups ? Number(mapMatch.groups.lat) : null,
    longitude: mapMatch?.groups ? Number(mapMatch.groups.lng) : null,
  };
}

function parseScreenName(screenBlock) {
  const alt = screenBlock.match(/alt=["']([^"']*screen[^"']*)["']/i)?.[1] ?? '';
  const number = alt.match(/(\d+)/)?.[1];
  if (number) {
    return `Screen ${number}`;
  }

  return normalizeWhitespace(screenBlock.match(/<p class="screenNumber">([\s\S]*?)<\/p>/i)?.[1] ?? '');
}

export function parseUnitedScheduleHtml(html, theater, requestedDate) {
  const metadata = parseUnitedTheaterMetadata(html, theater.name);
  const theaterName = metadata.name || theater.name;
  const movies = new Map();
  const showtimes = [];
  const movieBlocks = html.match(/<li class="clearfix[\s\S]*?(?=<li class="clearfix|<\/ul>\s*<section|<\/ul>\s*<\/div>|$)/gi) ?? [];

  for (const movieBlock of movieBlocks) {
    const title = normalizeWhitespace(
      movieBlock.match(/<span class="movieTitle">[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? ''
    );

    if (!title) {
      continue;
    }

    const href = movieBlock.match(/<span class="movieTitle">[\s\S]*?<a\b[^>]+href=["']([^"']+)/i)?.[1] ?? '';
    const movieCode = href.match(/film=(\d+)/)?.[1] ?? stableCode(title);
    const durationMinutes = durationTextToMinutes(movieBlock);

    if (!movies.has(movieCode)) {
      movies.set(movieCode, {
        provider: 'united',
        providerMovieCode: movieCode,
        title,
        englishTitle: null,
        durationMinutes,
        ratingCode: null,
        isNew: /new/i.test(movieBlock),
        posterUrl: '',
      });
    }

    const screenPositions = [...movieBlock.matchAll(/<p class="screenNumber">/gi)].map((match) => match.index);

    for (let index = 0; index < screenPositions.length; index += 1) {
      const startIndex = screenPositions[index];
      const endIndex = screenPositions[index + 1] ?? movieBlock.length;
      const screenBlock = movieBlock.slice(startIndex, endIndex);
      const screenName = parseScreenName(screenBlock);
      const screenCode = screenName.match(/\d+/)?.[0] ?? `${index + 1}`;

      for (const timeMatch of screenBlock.matchAll(
        /<li class="startTime">([^<]+)<\/li>\s*<li class="endTime">(?:～|~|&#65374;)?([^<]+)<\/li>/gi
      )) {
        const startsAt = buildJstDateTime(requestedDate, normalizeWhitespace(timeMatch[1]));
        const endsAt = buildJstDateTime(requestedDate, normalizeWhitespace(timeMatch[2]));

        showtimes.push({
          provider: 'united',
          theaterCode: theater.code,
          theaterName,
          movieCode,
          movieTitle: title,
          screenCode,
          screenName,
          startsAt,
          endsAt,
          seatStatus: null,
          isLateShow: /late|レイト/i.test(screenBlock),
          bookingCode: `${movieCode}-${screenCode}-${startsAt}`,
          bookingUrl: absoluteUrl(getAttr(screenBlock, 'href'), `${UNITED_BASE_URL}/${theater.code}/`),
        });
      }
    }
  }

  return {
    theater: {
      code: theater.code,
      name: theaterName,
      provider: 'united',
      chain: PROVIDER_CHAINS.united,
    },
    metadata,
    movies: [...movies.values()],
    showtimes,
  };
}

export async function fetchUnitedTheaters(fetchImpl = fetch) {
  const html = await fetchText(UNITED_THEATER_LIST_URL, fetchImpl, { charset: 'shift_jis' });
  return parseUnitedTheaterList(html);
}

export async function fetchUnitedSchedule(theater, date, fetchImpl = fetch) {
  const html = await fetchText(buildUnitedScheduleUrl(theater.code, date), fetchImpl, {
    charset: 'shift_jis',
  });
  return parseUnitedScheduleHtml(html, theater, date);
}

export async function fetchUnitedTheaterMetadata(theater, fetchImpl = fetch) {
  const html = await fetchText(`${UNITED_BASE_URL}/${theater.code}/about-theater.html`, fetchImpl, {
    charset: 'shift_jis',
  });
  return parseUnitedTheaterMetadata(html, theater.name);
}

export async function collectUnitedSchedules(
  { date, theaterCodes } = {},
  fetchImpl = fetch
) {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const snapshot = createEmptySnapshot('united', targetDate);
  const theaters = await fetchUnitedTheaters(fetchImpl);
  const selectedTheaters = theaterCodes?.length
    ? theaters.filter((theater) => theaterCodes.includes(theater.code))
    : theaters;

  const collected = await mapLimit(selectedTheaters, 4, async (theater) => {
    try {
      const [schedule, metadata] = await Promise.all([
        fetchUnitedSchedule(theater, targetDate, fetchImpl),
        fetchUnitedTheaterMetadata(theater, fetchImpl).catch(() => ({
          name: theater.name,
          address: '',
          latitude: null,
          longitude: null,
        })),
      ]);

      return {
        ...theater,
        name: schedule.theater.name || metadata.name || theater.name,
        address: metadata.address,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        movies: schedule.movies,
        showtimes: schedule.showtimes,
      };
    } catch (error) {
      snapshot.errors ??= [];
      snapshot.errors.push({
        provider: 'united',
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

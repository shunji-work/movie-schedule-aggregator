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
  toYmd,
} from './shared.js';

const SMT_BASE_URL = 'https://www.smt-cinema.com';
const SMT_THEATER_LIST_URL = `${SMT_BASE_URL}/assets/module/page_theater_list_partner.html`;
const SMT_SCHEDULE_BASE_URL = `${SMT_BASE_URL}/html/site/pc/schedule`;

export function buildSmtScheduleUrl(theaterCode, date) {
  const ymd = toYmd(date);
  return `${SMT_SCHEDULE_BASE_URL}/s0100_${theaterCode}_${ymd}_schedule_daily_movie_area.html`;
}

export function parseSmtTheaterList(html) {
  const theaters = [];
  const regex = /<li\b[^>]*id=["']theaterCode_(\d+)["'][^>]*>[\s\S]*?<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(regex)) {
    const code = match[1];
    const href = match[2];
    const name = normalizeWhitespace(match[3]);
    const slug = href.match(/\/site\/([^/]+)\//)?.[1] ?? code;

    theaters.push({
      code,
      slug,
      name,
      englishName: '',
      provider: 'smt',
      chain: PROVIDER_CHAINS.smt,
      scheduleUrl: absoluteUrl(href, SMT_BASE_URL),
    });
  }

  return theaters;
}

export function parseSmtTheaterPage(html, theater) {
  const title = normalizeWhitespace(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const name = title.match(/｜(.+)$/)?.[1] ?? theater.name;
  const address = normalizeWhitespace(
    html.match(/<th>\s*住所\s*<\/th>\s*<td>([\s\S]*?)<\/td>/i)?.[1] ??
      html.match(/<dt>\s*住所\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)?.[1] ??
      ''
  );

  return {
    name: normalizeWhitespace(name),
    address,
    latitude: null,
    longitude: null,
  };
}

function cleanSmtTitle(value) {
  return normalizeWhitespace(value)
    .replace(/\s*[A-Z][A-Z0-9/：・\s-]+$/g, '')
    .replace(/\s*（本編：?\d+分）/g, '')
    .trim();
}

export function parseSmtScheduleHtml(html, theater, requestedDate) {
  const movies = new Map();
  const showtimes = [];
  const sectionBlocks = html.match(/<section class="[^"]+">[\s\S]*?<\/section>/gi) ?? [];

  for (const section of sectionBlocks) {
    const rawTitle = section.match(/<div class="movieTitle">[\s\S]*?<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? '';
    const title = cleanSmtTitle(rawTitle);

    if (!title) {
      continue;
    }

    const movieCode =
      section.match(/<section class="(\d+)/i)?.[1] ??
      section.match(/cinemaid=([^"&]+)/i)?.[1] ??
      stableCode(title);
    const durationMinutes = durationTextToMinutes(rawTitle);
    const posterUrl = absoluteUrl(
      section.match(/<p class="thumbnail">[\s\S]*?<img\b[^>]+src=["']([^"']+)/i)?.[1] ?? '',
      SMT_BASE_URL
    );

    if (!movies.has(movieCode)) {
      movies.set(movieCode, {
        provider: 'smt',
        providerMovieCode: movieCode,
        title,
        englishTitle: normalizeWhitespace(section.match(/<span class="enLabel">([\s\S]*?)<\/span>/i)?.[1] ?? '') || null,
        durationMinutes,
        ratingCode: null,
        isNew: /class="new"/i.test(section),
        posterUrl,
      });
    }

    const blockMatches = section.match(/<div class="block[\s\S]*?(?=<div class="block|<\/div>\s*<\/div>\s*<span class="next|<\/section>)/gi) ?? [];

    for (const block of blockMatches) {
      const screenName = normalizeWhitespace(block.match(/<h3>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '');
      const screenCode =
        block.match(/class=["']T\d+S(\d+)/i)?.[1] ??
        screenName.normalize('NFKC').match(/\d+/)?.[0] ??
        stableCode(screenName || title);

      for (const inner of block.matchAll(/<div class="inner[^"]*"[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/div>/gi)) {
        const body = inner[2];
        const timeMatch = body.match(/<p class="time">\s*<span>([^<]+)<\/span>\s*([^<]+)\s*<\/p>/i);

        if (!timeMatch) {
          continue;
        }

        const start = normalizeWhitespace(timeMatch[1]).replace('～', '');
        const end = normalizeWhitespace(timeMatch[2]);
        const startsAt = buildJstDateTime(requestedDate, start);

        showtimes.push({
          provider: 'smt',
          theaterCode: theater.code,
          theaterName: theater.name,
          movieCode,
          movieTitle: title,
          screenCode,
          screenName,
          startsAt,
          endsAt: buildJstDateTime(requestedDate, end),
          seatStatus: normalizeWhitespace(body.match(/<span class="sheet[^"]*">([\s\S]*?)<\/span>/i)?.[1] ?? '') || null,
          isLateShow: /レイト|late/i.test(body),
          bookingCode: inner[1],
          bookingUrl: `${theater.scheduleUrl}?sc=${toYmd(requestedDate)}`,
        });
      }
    }
  }

  return {
    theater: {
      code: theater.code,
      name: theater.name,
      provider: 'smt',
      chain: PROVIDER_CHAINS.smt,
    },
    movies: [...movies.values()],
    showtimes,
  };
}

export async function fetchSmtTheaters(fetchImpl = fetch) {
  const html = await fetchText(SMT_THEATER_LIST_URL, fetchImpl);
  return parseSmtTheaterList(html);
}

export async function fetchSmtTheaterMetadata(theater, fetchImpl = fetch) {
  const html = await fetchText(`${SMT_BASE_URL}/site/${theater.slug}/`, fetchImpl);
  return parseSmtTheaterPage(html, theater);
}

export async function fetchSmtSchedule(theater, date, fetchImpl = fetch) {
  const html = await fetchText(buildSmtScheduleUrl(theater.code, date), fetchImpl);
  return parseSmtScheduleHtml(html, theater, date);
}

export async function collectSmtSchedules(
  { date, theaterCodes } = {},
  fetchImpl = fetch
) {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const snapshot = createEmptySnapshot('smt', targetDate);
  const theaters = await fetchSmtTheaters(fetchImpl);
  const selectedTheaters = theaterCodes?.length
    ? theaters.filter((theater) => theaterCodes.includes(theater.code) || theaterCodes.includes(theater.slug))
    : theaters;

  const collected = await mapLimit(selectedTheaters, 4, async (theater) => {
    try {
      const metadata = await fetchSmtTheaterMetadata(theater, fetchImpl).catch(() => ({
        name: theater.name,
        address: '',
        latitude: null,
        longitude: null,
      }));
      const hydratedTheater = {
        ...theater,
        ...metadata,
      };
      const schedule = await fetchSmtSchedule(hydratedTheater, targetDate, fetchImpl);

      return {
        ...hydratedTheater,
        movies: schedule.movies,
        showtimes: schedule.showtimes,
      };
    } catch (error) {
      snapshot.errors ??= [];
      snapshot.errors.push({
        provider: 'smt',
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

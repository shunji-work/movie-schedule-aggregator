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
  uniqueBy,
} from './shared.js';

const CINEMAS109_BASE_URL = 'https://109cinemas.net';
const CINEMAS109_HOME_URL = `${CINEMAS109_BASE_URL}/`;
const CINEMAS109_LOCATION_OVERRIDES = {
  tomiya: { latitude: 38.3598, longitude: 140.8824 },
  premiumshinjuku: { latitude: 35.6957, longitude: 139.7006 },
  sano: { latitude: 36.2939, longitude: 139.5964 },
  shobu: { latitude: 36.0722, longitude: 139.6028 },
  kiba: { latitude: 35.667, longitude: 139.8068 },
  futakotamagawa: { latitude: 35.6115, longitude: 139.6264 },
  grandberrypark: { latitude: 35.5115, longitude: 139.469 },
  kohoku: { latitude: 35.5527, longitude: 139.5781 },
  kawasaki: { latitude: 35.5312, longitude: 139.6967 },
  shonan: { latitude: 35.3367, longitude: 139.4443 },
  movil: { latitude: 35.4649, longitude: 139.6188 },
  yumegaoka: { latitude: 35.4055, longitude: 139.4834 },
  nagoya: { latitude: 35.1636, longitude: 136.884 },
  yokkaichi: { latitude: 34.967, longitude: 136.6189 },
  meiwa: { latitude: 34.5459, longitude: 136.6189 },
  'osaka-expocity': { latitude: 34.8063, longitude: 135.5324 },
  minoh: { latitude: 34.8338, longitude: 135.4902 },
  hatkobe: { latitude: 34.704, longitude: 135.2162 },
  hiroshima: { latitude: 34.3727, longitude: 132.3919 },
  saga: { latitude: 33.2639, longitude: 130.3209 },
};

export function build109ScheduleUrl(theater, date) {
  return `${CINEMAS109_BASE_URL}/${theater.slug}/schedules/${toYmd(date)}.html?theater_code=${theater.ticketCode}`;
}

export function parse109TheaterList(html) {
  const theaters = [];
  const regex = /<a\b[^>]+href=["']\/?([a-z0-9-]+)\/["'][^>]*>([\s\S]*?)<\/a>/gi;
  const ignored = new Set([
    '4dx',
    'comingsoon',
    'events',
    'imax',
    'kidscinema',
    'movies',
    'news',
    'newsletter',
    'nowshowing',
    'pointcard',
    'service',
    'theater_rental',
    'tickets',
  ]);

  for (const match of html.matchAll(regex)) {
    const slug = match[1];
    const label = normalizeWhitespace(match[2]);

    if (!slug || !label || ignored.has(slug)) {
      continue;
    }

    theaters.push({
      code: slug,
      slug,
      ticketCode: '',
      name: label,
      englishName: '',
      provider: '109',
      chain: PROVIDER_CHAINS['109'],
      scheduleUrl: `${CINEMAS109_BASE_URL}/${slug}/`,
    });
  }

  return uniqueBy(theaters, (theater) => theater.code);
}

function parseJsonLdTheater(html) {
  for (const match of html.matchAll(/<script\b[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1]);
      if (data?.['@type'] !== 'MovieTheater') {
        continue;
      }

      const address = data.address
        ? [
            data.address.addressRegion,
            data.address.addressLocality,
            data.address.streetAddress,
          ]
            .filter(Boolean)
            .join('')
        : '';

      return {
        name: data.name ?? '',
        address,
      };
    } catch {
      // Keep scanning other JSON-LD blocks.
    }
  }

  return {
    name: '',
    address: '',
  };
}

export function parse109TheaterPage(html, theater) {
  const jsonLd = parseJsonLdTheater(html);
  const location = CINEMAS109_LOCATION_OVERRIDES[theater.code] ?? null;
  const ticketCode =
    html.match(/theater_code=([A-Z0-9]+)/i)?.[1] ??
    html.match(/[?&]tsc=([A-Z0-9]+)/i)?.[1] ??
    theater.ticketCode ??
    '';

  return {
    ...theater,
    ticketCode,
    name: normalizeWhitespace(jsonLd.name) || theater.name,
    address: normalizeWhitespace(jsonLd.address),
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
  };
}

function split109TimetableBlocks(articleBlock) {
  return articleBlock.match(/<ul class="timetable">[\s\S]*?<\/ul>/gi) ?? [];
}

export function parse109ScheduleHtml(html, theater, requestedDate) {
  const movies = new Map();
  const showtimes = [];
  const articleBlocks = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];

  for (const article of articleBlocks) {
    const title = normalizeWhitespace(article.match(/<header>[\s\S]*?<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? '');

    if (!title) {
      continue;
    }

    const movieCode =
      article.match(/\bclass=["'][^"']*\bmg([A-Z0-9]+)\b/i)?.[1] ??
      article.match(/\bid=["']([^"']+)/i)?.[1] ??
      stableCode(title);
    const englishTitle = normalizeWhitespace(article.match(/<p lang="en">([\s\S]*?)<\/p>/i)?.[1] ?? '') || null;
    const durationMinutes = durationTextToMinutes(article);

    if (!movies.has(movieCode)) {
      movies.set(movieCode, {
        provider: '109',
        providerMovieCode: movieCode,
        title,
        englishTitle,
        durationMinutes,
        ratingCode: null,
        isNew: false,
        posterUrl: '',
      });
    }

    for (const timetable of split109TimetableBlocks(article)) {
      const screenName = normalizeWhitespace(
        timetable.match(/<li class="theatre">([\s\S]*?)<\/li>/i)?.[1] ?? ''
      );
      const screenCode = screenName.normalize('NFKC').match(/\d+/)?.[0] ?? stableCode(screenName || title);
      const timeItems = timetable.match(/<li\b(?![^>]*class=["']theatre["'])[\s\S]*?(?=<li\b|<\/ul>)/gi) ?? [];

      for (const item of timeItems) {
        const start = normalizeWhitespace(item.match(/<time class="start">([\s\S]*?)<\/time>/i)?.[1] ?? '');
        const end = normalizeWhitespace(item.match(/<time class="end">([\s\S]*?)<\/time>/i)?.[1] ?? '');

        if (!start || !end) {
          continue;
        }

        const startsAt = buildJstDateTime(requestedDate, start);

        showtimes.push({
          provider: '109',
          theaterCode: theater.code,
          theaterName: theater.name,
          movieCode,
          movieTitle: title,
          screenCode,
          screenName,
          startsAt,
          endsAt: buildJstDateTime(requestedDate, end),
          seatStatus: normalizeWhitespace(item.match(/<div class="([^"]*(?:available|close|few)[^"]*)">([\s\S]*?)<\/div>/i)?.[2] ?? '') || null,
          isLateShow: /\[L\]|late/i.test(item),
          bookingCode: item.match(/data-date=["']([^"']+)/i)?.[1] ?? `${movieCode}-${screenCode}-${startsAt}`,
          bookingUrl: absoluteUrl(item.match(/<a\b[^>]+href=["']([^"']+)/i)?.[1] ?? '', CINEMAS109_BASE_URL),
        });
      }
    }
  }

  return {
    theater: {
      code: theater.code,
      name: theater.name,
      provider: '109',
      chain: PROVIDER_CHAINS['109'],
    },
    movies: [...movies.values()],
    showtimes,
  };
}

export async function fetch109Theaters(fetchImpl = fetch) {
  const html = await fetchText(CINEMAS109_HOME_URL, fetchImpl);
  return parse109TheaterList(html);
}

export async function fetch109TheaterMetadata(theater, fetchImpl = fetch) {
  const html = await fetchText(`${CINEMAS109_BASE_URL}/${theater.slug}/`, fetchImpl);
  return parse109TheaterPage(html, theater);
}

export async function fetch109Schedule(theater, date, fetchImpl = fetch) {
  const html = await fetchText(build109ScheduleUrl(theater, date), fetchImpl);
  return parse109ScheduleHtml(html, theater, date);
}

export async function collect109Schedules(
  { date, theaterCodes } = {},
  fetchImpl = fetch
) {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const snapshot = createEmptySnapshot('109', targetDate);
  const theaters = await fetch109Theaters(fetchImpl);
  const selectedTheaters = theaterCodes?.length
    ? theaters.filter((theater) => theaterCodes.includes(theater.code))
    : theaters;

  const collected = await mapLimit(selectedTheaters, 4, async (theater) => {
    try {
      const metadata = await fetch109TheaterMetadata(theater, fetchImpl);

      if (!metadata.ticketCode) {
        throw new Error(`Missing 109 theater code for ${theater.code}`);
      }

      const schedule = await fetch109Schedule(metadata, targetDate, fetchImpl);

      return {
        ...metadata,
        movies: schedule.movies,
        showtimes: schedule.showtimes,
      };
    } catch (error) {
      snapshot.errors ??= [];
      snapshot.errors.push({
        provider: '109',
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

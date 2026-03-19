const TOHO_THEATER_LIST_URL = 'https://www.tohotheater.jp/theater/find.html';
const TOHO_SCHEDULE_API = 'https://api2.tohotheater.jp/api/schedule/v1/schedule';
const TOHO_MOVIE_IMAGE_BASE = 'https://hlo.tohotheater.jp/images_net/movie';

function toYmd(date) {
  return date.replaceAll('-', '');
}

function decodeShiftJis(buffer) {
  return new TextDecoder('shift_jis').decode(buffer);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchShiftJisText(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': 'movie-schedule-aggregator/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  const buffer = await response.arrayBuffer();
  return decodeShiftJis(buffer);
}

async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': 'movie-schedule-aggregator/1.0',
      accept: 'application/json,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

export function parseTohoTheaterList(html) {
  const regex =
    /<a href="\/net\/schedule\/(?<code>\d{3})\/TNPI2000J01\.do"><span>(?<name>[\s\S]*?)<span class="nav-local-en">(?<english>[^<]+)<\/span><\/span><\/a>/g;
  const theaters = new Map();

  for (const match of html.matchAll(regex)) {
    const code = match.groups?.code;
    if (!code || theaters.has(code)) {
      continue;
    }

    const rawName = decodeEntities(stripTags(match.groups.name));
    theaters.set(code, {
      code,
      name: normalizeWhitespace(rawName),
      englishName: normalizeWhitespace(match.groups.english),
      provider: 'toho',
      scheduleUrl: `https://hlo.tohotheater.jp/net/schedule/${code}/TNPI2000J01.do`,
    });
  }

  return [...theaters.values()];
}

export function buildTohoScheduleApiUrl(theaterCode, date) {
  const showDay = toYmd(date);
  const url = new URL(
    `${TOHO_SCHEDULE_API}/${theaterCode}/TNPI3050J02`
  );

  url.searchParams.set('__type__', 'html');
  url.searchParams.set('__useResultInfo__', 'no');
  url.searchParams.set('vg_cd', theaterCode);
  url.searchParams.set('show_day', showDay);
  url.searchParams.set('term', '99');
  url.searchParams.set('isMember', '');
  url.searchParams.set('enter_kbn', '');
  url.searchParams.set('_dc', `${Math.floor(Date.now() / 1000)}`);

  return url.toString();
}

export function buildTohoPosterUrl(movieCode) {
  return `${TOHO_MOVIE_IMAGE_BASE}/${movieCode}/SAKUHIN${movieCode}_1.jpg`;
}

export function buildTohoAccessUrl(theaterCode) {
  return `https://www.tohotheater.jp/theater/${theaterCode}/access.html`;
}

export function parseTohoAccessPage(html) {
  const iframeMatch = html.match(/!2d(?<lng>-?\d+\.\d+)!3d(?<lat>-?\d+\.\d+)/);
  const mapMatch = html.match(/@(?<lat>-?\d+\.\d+),(?<lng>-?\d+\.\d+),/);
  const match = iframeMatch ?? mapMatch;

  if (!match?.groups) {
    return {
      latitude: null,
      longitude: null,
      address: '',
    };
  }

  return {
    latitude: Number(match.groups.lat),
    longitude: Number(match.groups.lng),
    address: '',
  };
}

export function parseTohoScheduleResponse(payload, requestedDate) {
  if (payload.status !== '0') {
    throw new Error(`Unexpected TOHO payload status: ${payload.status}`);
  }

  const theater = payload.data?.[0];
  const site = theater?.list?.[0];
  const normalizedDate = requestedDate;

  if (!site) {
    return {
      theater: null,
      movies: [],
      showtimes: [],
    };
  }

  const movies = [];
  const showtimes = [];
  const seenMovies = new Set();

  for (const movie of site.list ?? []) {
    if (!seenMovies.has(movie.code)) {
      movies.push({
        providerMovieCode: movie.code,
        title: movie.name,
        englishTitle: movie.ename || null,
        durationMinutes: movie.hours,
        ratingCode: movie.ratingCd || null,
        isNew: movie.newShow === '1' || movie.newShow === '2',
        posterUrl: buildTohoPosterUrl(movie.code),
      });
      seenMovies.add(movie.code);
    }

    for (const screen of movie.list ?? []) {
      for (const item of screen.list ?? []) {
        if (!item.showingStart || !item.showingEnd || item.code === 0) {
          continue;
        }

        showtimes.push({
          provider: 'toho',
          theaterCode: site.code,
          theaterName: site.name,
          movieCode: movie.code,
          movieTitle: movie.name,
          screenCode: screen.code,
          screenName: screen.name,
          startsAt: `${normalizedDate}T${item.showingStart}:00+09:00`,
          endsAt: `${normalizedDate}T${item.showingEnd}:00+09:00`,
          seatStatus: item.unsoldSeatInfo?.unsoldSeatStatus ?? null,
          isLateShow: item.bgColor === '#E4E3DF',
          bookingCode: item.code,
        });
      }
    }
  }

  return {
    theater: {
      code: site.code,
      name: site.name,
      provider: 'toho',
    },
    movies,
    showtimes,
  };
}

export async function fetchTohoTheaters(fetchImpl = fetch) {
  const html = await fetchShiftJisText(TOHO_THEATER_LIST_URL, fetchImpl);
  return parseTohoTheaterList(html);
}

export async function fetchTohoSchedule(theaterCode, date, fetchImpl = fetch) {
  const payload = await fetchJson(buildTohoScheduleApiUrl(theaterCode, date), fetchImpl);
  return parseTohoScheduleResponse(payload, date);
}

export async function fetchTohoTheaterMetadata(theaterCode, fetchImpl = fetch) {
  const html = await fetchShiftJisText(buildTohoAccessUrl(theaterCode), fetchImpl);
  return parseTohoAccessPage(html);
}

export async function collectTohoSchedules(
  { date, theaterCodes } = {},
  fetchImpl = fetch
) {
  const targetDate = date ?? new Date().toISOString().slice(0, 10);
  const theaters = await fetchTohoTheaters(fetchImpl);
  const selectedTheaters = theaterCodes?.length
    ? theaters.filter((theater) => theaterCodes.includes(theater.code))
    : theaters;

  const collected = await Promise.all(
    selectedTheaters.map(async (theater) => {
      const schedulePromise = fetchTohoSchedule(theater.code, targetDate, fetchImpl).catch(
        (error) => {
          if (
            error instanceof Error &&
            error.message === 'Unexpected TOHO payload status: 1'
          ) {
            return {
              theater: {
                code: theater.code,
                name: theater.name,
                provider: 'toho',
              },
              movies: [],
              showtimes: [],
            };
          }

          throw error;
        }
      );
      const [schedule, metadata] = await Promise.all([
        schedulePromise,
        fetchTohoTheaterMetadata(theater.code, fetchImpl).catch(() => ({
          latitude: null,
          longitude: null,
          address: '',
        })),
      ]);
      return {
        ...theater,
        ...metadata,
        movies: schedule.movies,
        showtimes: schedule.showtimes,
      };
    })
  );

  return {
    provider: 'toho',
    date: targetDate,
    collectedAt: new Date().toISOString(),
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

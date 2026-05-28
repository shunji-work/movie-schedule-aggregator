import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import {
  buildTohoAccessUrl,
  buildTohoScheduleApiUrl,
  buildTohoPosterUrl,
  collectTohoSchedules,
  parseTohoAccessPage,
  parseTohoScheduleResponse,
  parseTohoTheaterList,
} from '../scripts/collectors/toho.js';
import {
  parseAeonScheduleResponse,
  parseAeonTheaterList,
} from '../scripts/collectors/aeon.js';
import {
  parse109ScheduleHtml,
  parse109TheaterPage,
} from '../scripts/collectors/cinemas109.js';
import { collectAllSchedules } from '../scripts/collectors/index.js';
import { parseSmtScheduleHtml } from '../scripts/collectors/smt.js';
import { parseTjoyScheduleHtml } from '../scripts/collectors/tjoy.js';
import {
  parseUnitedScheduleHtml,
  parseUnitedTheaterList,
} from '../scripts/collectors/united.js';
import {
  normalizeRatingTitle,
  parseFilmarksSearchHtml,
} from '../scripts/ratings/filmarks.js';

async function run(name, fn) {
  try {
    await fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

await run('parseTohoTheaterList extracts unique theaters', async () => {
  const html = await fs.readFile('test/fixtures/toho-theaters.html', 'utf8');
  const theaters = parseTohoTheaterList(html);

  assert.equal(theaters.length, 2);
  assert.deepEqual(theaters[0], {
    code: '081',
    name: 'TOHO CINEMAS HIBIYA',
    englishName: 'TOHO CINEMAS HIBIYA',
    provider: 'toho',
    chain: 'TOHO Cinemas',
    scheduleUrl: 'https://hlo.tohotheater.jp/net/schedule/081/TNPI2000J01.do',
  });
});

await run('buildTohoScheduleApiUrl embeds date and theater code', async () => {
  const url = buildTohoScheduleApiUrl('009', '2026-03-19');

  assert.match(url, /vg_cd=009/);
  assert.match(url, /show_day=20260319/);
  assert.match(url, /TNPI3050J02/);
});

await run('buildTohoPosterUrl builds official TOHO image URL', async () => {
  assert.equal(
    buildTohoPosterUrl('027888'),
    'https://hlo.tohotheater.jp/images_net/movie/027888/SAKUHIN027888_1.jpg'
  );
});

await run('buildTohoAccessUrl builds official TOHO access page URL', async () => {
  assert.equal(
    buildTohoAccessUrl('009'),
    'https://www.tohotheater.jp/theater/009/access.html'
  );
});

await run('parseTohoAccessPage extracts latitude and longitude', async () => {
  const html = `
    <iframe src="https://www.google.com/maps/embed?pb=!1m18!2d139.7271376152281!3d35.659657638762255!4m"></iframe>
  `;

  assert.deepEqual(parseTohoAccessPage(html), {
    latitude: 35.659657638762255,
    longitude: 139.7271376152281,
    address: '',
  });
});

await run('parseTohoScheduleResponse normalizes movie and showtime data', async () => {
  const payload = JSON.parse(await fs.readFile('test/fixtures/toho-schedule.json', 'utf8'));
  const parsed = parseTohoScheduleResponse(payload, '2026-03-19');

  assert.equal(parsed.theater?.code, '009');
  assert.equal(parsed.movies.length, 1);
  assert.equal(parsed.showtimes.length, 1);
  assert.equal(
    parsed.movies[0].posterUrl,
    'https://hlo.tohotheater.jp/images_net/movie/027888/SAKUHIN027888_1.jpg'
  );
  assert.deepEqual(parsed.showtimes[0], {
    provider: 'toho',
    theaterCode: '009',
    theaterName: 'ＴＯＨＯシネマズ六本木ヒルズ',
    movieCode: '027888',
    movieTitle: 'ゴールデンカムイ　網走監獄襲撃編',
    screenCode: '22',
    screenName: 'スクリーン２',
    startsAt: '2026-03-19T11:40:00+09:00',
    endsAt: '2026-03-19T14:00:00+09:00',
    seatStatus: 'A',
    isLateShow: false,
    bookingCode: 2,
    bookingUrl: 'https://hlo.tohotheater.jp/net/schedule/009/TNPI2000J01.do',
  });
});

await run('parseTohoScheduleResponse pads single-digit showtime hours', async () => {
  const payload = JSON.parse(await fs.readFile('test/fixtures/toho-schedule.json', 'utf8'));
  const showtime = payload.data[0].list[0].list[0].list[0].list[0];

  showtime.showingStart = '9:15';
  showtime.showingEnd = '11:35';

  const parsed = parseTohoScheduleResponse(payload, '2026-05-28');

  assert.equal(parsed.showtimes[0].startsAt, '2026-05-28T09:15:00+09:00');
  assert.equal(parsed.showtimes[0].endsAt, '2026-05-28T11:35:00+09:00');
  assert.equal(Number.isNaN(new Date(parsed.showtimes[0].startsAt).getTime()), false);
});

await run('parseTohoScheduleResponse uses master movie code for poster URL', async () => {
  const payload = JSON.parse(await fs.readFile('test/fixtures/toho-schedule.json', 'utf8'));
  const movie = payload.data[0].list[0].list[0];

  movie.code = '028738';
  movie.mcode = '028267';

  const parsed = parseTohoScheduleResponse(payload, '2026-03-19');

  assert.equal(parsed.movies[0].providerMovieCode, '028738');
  assert.equal(parsed.showtimes[0].movieCode, '028738');
  assert.equal(
    parsed.movies[0].posterUrl,
    'https://hlo.tohotheater.jp/images_net/movie/028267/SAKUHIN028267_1.jpg'
  );
});

await run('collectTohoSchedules aggregates theater, movie, and showtime records', async () => {
  const html = await fs.readFile('test/fixtures/toho-theaters.html', 'utf8');
  const payload = JSON.parse(await fs.readFile('test/fixtures/toho-schedule.json', 'utf8'));

  const fetchStub = async (url) => {
    if (String(url).includes('/theater/find.html')) {
      return {
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(html),
      };
    }

    if (String(url).includes('/theater/081/access.html')) {
      return {
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            '<iframe src="https://www.google.com/maps/embed?pb=!1m18!2d139.7596!3d35.6745!4m"></iframe>'
          ),
      };
    }

    return {
      ok: true,
      json: async () => payload,
    };
  };

  const result = await collectTohoSchedules(
    { date: '2026-03-19', theaterCodes: ['081'] },
    fetchStub
  );

  assert.equal(result.provider, 'toho');
  assert.equal(result.date, '2026-03-19');
  assert.equal(result.theaters.length, 1);
  assert.equal(result.movies.length, 1);
  assert.equal(result.showtimes.length, 1);
  assert.equal(result.theaters[0].latitude, 35.6745);
  assert.equal(result.theaters[0].longitude, 139.7596);
});

await run('collectTohoSchedules skips theaters with unavailable schedules', async () => {
  const theaterHtml = `
    <a href="/net/schedule/081/TNPI2000J01.do"><span>TOHOシネマズ日比谷<span class="nav-local-en">HIBIYA</span></span></a>
    <a href="/net/schedule/009/TNPI2000J01.do"><span>TOHOシネマズ六本木ヒルズ<span class="nav-local-en">ROPPONGI HILLS</span></span></a>
  `;

  const payload = JSON.parse(await fs.readFile('test/fixtures/toho-schedule.json', 'utf8'));

  const result = await collectTohoSchedules({ date: '2026-03-19' }, async (url) => {
    if (String(url).includes('find.html')) {
      return {
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(theaterHtml),
      };
    }

    if (String(url).includes('/theater/081/access.html')) {
      return {
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            '<iframe src="https://www.google.com/maps/embed?pb=!1m18!2d139.7596!3d35.6745!4m"></iframe>'
          ),
      };
    }

    if (String(url).includes('/theater/009/access.html')) {
      return {
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            '<iframe src="https://www.google.com/maps/embed?pb=!1m18!2d139.7271!3d35.6596!4m"></iframe>'
          ),
      };
    }

    if (String(url).includes('/schedule/009/')) {
      return {
        ok: true,
        json: async () => ({ status: '1', data: [] }),
      };
    }

    return {
      ok: true,
      json: async () => payload,
    };
  });

  assert.equal(result.theaters.length, 2);
  assert.equal(result.movies.length, 1);
  assert.equal(result.showtimes.length, 1);
  assert.equal(result.theaters[1].code, '009');
});

await run('parseAeonTheaterList extracts official theater aliases', async () => {
  const html = `
    <a href="/cinema/tama/">Tama Center</a>
    <a href="/cinema/chofu/">Chofu</a>
    <a href="/cinema/tama/">Tama Center</a>
  `;
  const theaters = parseAeonTheaterList(html);

  assert.equal(theaters.length, 2);
  assert.equal(theaters[0].code, 'tama');
  assert.equal(theaters[0].provider, 'aeon');
});

await run('parseAeonScheduleResponse normalizes JSON schedule data', async () => {
  const theater = {
    code: 'tama',
    name: 'AEON Tama',
    scheduleUrl: 'https://theater.aeoncinema.com/theaters/tama/',
  };
  const payload = {
    20260531: {
      event1: [
        {
          id: 'event-1',
          startDate: '2026-05-31T00:30:00.000Z',
          endDate: '2026-05-31T02:30:00.000Z',
          maximumAttendeeCapacity: 100,
          remainingAttendeeCapacity: 75,
          location: { branchCode: '01', name: { ja: 'Screen 1' } },
          superEvent: {
            id: 'event1',
            name: { ja: 'Shared Movie', en: 'Shared Movie' },
            workPerformed: { identifier: 'M-AEON' },
          },
        },
      ],
    },
  };
  const moviesMaster = {
    'M-AEON': {
      name: { en: 'Shared Movie', ja: 'Shared Movie' },
      duration: 'PT2H',
      thumbnailUrl: 'https://example.com/poster.jpg',
    },
  };
  const parsed = parseAeonScheduleResponse(payload, moviesMaster, theater, '2026-05-31');

  assert.equal(parsed.movies[0].durationMinutes, 120);
  assert.equal(parsed.showtimes[0].startsAt, '2026-05-31T09:30:00+09:00');
  assert.equal(parsed.showtimes[0].seatStatus, '75/100');
});

await run('parseUnitedScheduleHtml normalizes movie and showtime data', async () => {
  const html = `
    <title>Toyosu Movie Schedule</title>
    <ul id="dailyList">
      <li class="clearfix">
        <h3><span class="movieTitle"><a href="film.php?film=21596">Shared Movie</a></span></h3>
        <ul class="tl"><li><p class="screenNumber"><a href="seat/09.html"><img alt="9screen"></a></p>
          <ol><li><div><ol><li class="startTime">10:15</li><li class="endTime">~12:27</li></ol></div></li></ol>
          <ul><li class="uolIcon"><a href="/all/cc.php?tc=018&amp;sd=20260527&amp;sc=009&amp;st=20260527101500&amp;mc=21596"><img alt="[○]"></a></li></ul>
        </li></ul>
      </li>
    </ul>
  `;
  const parsed = parseUnitedScheduleHtml(html, { code: 'toyosu', name: 'Toyosu' }, '2026-05-27');

  assert.equal(parsed.movies[0].providerMovieCode, '21596');
  assert.equal(parsed.showtimes[0].screenCode, '9');
  assert.equal(parsed.showtimes[0].startsAt, '2026-05-27T10:15:00+09:00');
  assert.equal(parsed.showtimes[0].seatStatus, '[○]');
  assert.equal(
    parsed.showtimes[0].bookingUrl,
    'https://www.unitedcinemas.jp/all/cc.php?tc=018&sd=20260527&sc=009&st=20260527101500&mc=21596'
  );
});

await run('parseUnitedTheaterList extracts theater paths', async () => {
  const html = `
    <a href="/toyosu/index.html">Toyosu</a>
    <a href="/clubspice/index.html">Club Spice</a>
    <a href="/odaiba/">Odaiba</a>
  `;
  const theaters = parseUnitedTheaterList(html);

  assert.deepEqual(
    theaters.map((theater) => theater.code),
    ['toyosu', 'odaiba']
  );
});

await run('parse109ScheduleHtml normalizes schedule page data', async () => {
  const html = `
    <article id="m1" class="mg51000">
      <header><a><h2>Shared Movie</h2><p lang="en">Shared Movie</p></a></header>
      <ul class="timetable">
        <li class="theatre"><a>Screen <span class="theatre-num">9</span></a><small>132 min</small></li>
        <li data-date="202605272055"><a href="/buy"><time class="start">20:55</time>~<time class="end">23:20</time><div class="available">Buy</div></a></li>
      </ul>
    </article>
  `;
  const parsed = parse109ScheduleHtml(html, { code: 'shobu', name: '109 Shobu' }, '2026-05-27');

  assert.equal(parsed.movies[0].providerMovieCode, '51000');
  assert.equal(parsed.showtimes[0].endsAt, '2026-05-27T23:20:00+09:00');
  assert.equal(parsed.showtimes[0].bookingUrl, 'https://109cinemas.net/buy');
});

await run('parse109TheaterPage fills known theater coordinates', async () => {
  const html = `
    <script type="application/ld+json">
      {
        "@type": "MovieTheater",
        "name": "１０９シネマズ二子玉川",
        "address": {
          "addressRegion": "東京都",
          "addressLocality": "世田谷区",
          "streetAddress": "玉川1-14-1"
        }
      }
    </script>
  `;
  const parsed = parse109TheaterPage(html, {
    code: 'futakotamagawa',
    slug: 'futakotamagawa',
    ticketCode: 'P0',
    name: '109 Futako',
  });

  assert.equal(parsed.name, '１０９シネマズ二子玉川');
  assert.equal(parsed.latitude, 35.6115);
  assert.equal(parsed.longitude, 139.6264);
});

await run('parseSmtScheduleHtml normalizes generated schedule HTML', async () => {
  const html = `
    <section class="47697 A0004559">
      <div class="movieTitle"><h2>Shared Movie (main: 160 min)<span class="enLabel">Shared Movie</span></h2></div>
      <p class="thumbnail"><img src="/poster.jpg"></p>
      <div class="block ok">
        <h3><a class="T1022S10">Screen 10</a></h3>
        <div class="inner ok" id="perf-1"><p class="time"><span>18:00~</span> 20:40</p><p><span class="sheet ok">Open</span></p></div>
      </div>
    </section>
  `;
  const parsed = parseSmtScheduleHtml(
    html,
    { code: '1022', name: 'MOVIX Saitama', scheduleUrl: 'https://www.smt-cinema.com/site/saitama/' },
    '2026-05-27'
  );

  assert.equal(parsed.showtimes[0].screenCode, '10');
  assert.equal(parsed.showtimes[0].startsAt, '2026-05-27T18:00:00+09:00');
});

await run('parseTjoyScheduleHtml normalizes theater schedule cards', async () => {
  const html = `
    <a class="calendar-item d-block calendar-active" data-date="2026-05-27"></a>
    <section class="section-container bg-white">
      <h5 class="js-title-film font-weight-bold">Shared Movie</h5>
      <p class="time-film">(main: 160 min)</p>
      <div class="card-body film-content bg-white" id="film-O2412000">
        <ul class="row mb-0 theater">
          <li class="schedule-box theater-item">
            <div class="theater-name"><a>Screen 9</a></div>
            <div onclick="location.href ='/wald/reservation/index/1/O2412000/9/2026-05-27?type=film'">
              <p class="schedule-time mb-0">18:00<span>~ 20:40</span></p>
              <p class="schedule-status"><span>Buy</span></p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  `;
  const parsed = parseTjoyScheduleHtml(html, { code: 'wald', name: 'T-Joy Wald' }, '2026-05-27');

  assert.equal(parsed.movies[0].providerMovieCode, 'O2412000');
  assert.equal(parsed.showtimes[0].screenCode, '9');
  assert.equal(parsed.showtimes[0].bookingUrl, 'https://tjoy.jp/wald/reservation/index/1/O2412000/9/2026-05-27?type=film');
});

await run('parseFilmarksSearchHtml extracts matching rating results', async () => {
  const html = `
    <main>
      <div class="p-content-cassette">
        <a href="/movies/100">
          <h3 class="p-content-cassette__title">Other Movie</h3>
          <div class="c-rating__score">3.1</div>
        </a>
      </div>
      <div class="p-content-cassette">
        <a href="/movies/200">
          <h3 class="p-content-cassette__title">Shared Movie</h3>
          <div class="c-rating__score">4.4</div>
        </a>
      </div>
    </main>
  `;
  const parsed = parseFilmarksSearchHtml(html, 'Shared Movie \u5B57\u5E55\u7248');

  assert.equal(parsed.rating, 4.4);
  assert.equal(parsed.url, 'https://filmarks.com/movies/200');
  assert.equal(normalizeRatingTitle('\u6620\u753B\u300CShared Movie\u300D\u5B57\u5E55\u7248'), 'sharedmovie');
});

await run('collectAllSchedules keeps partial results when a provider fails', async () => {
  const html = await fs.readFile('test/fixtures/toho-theaters.html', 'utf8');
  const payload = JSON.parse(await fs.readFile('test/fixtures/toho-schedule.json', 'utf8'));

  const result = await collectAllSchedules({ date: '2026-03-19', theaterCodes: ['081'] }, async (url) => {
    if (String(url).includes('/theater/find.html')) {
      return {
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(html),
      };
    }

    if (String(url).includes('/theater/081/access.html')) {
      return {
        ok: true,
        arrayBuffer: async () =>
          new TextEncoder().encode(
            '<iframe src="https://www.google.com/maps/embed?pb=!1m18!2d139.7596!3d35.6745!4m"></iframe>'
          ),
      };
    }

    if (String(url).includes('/schedule/081/')) {
      return {
        ok: true,
        json: async () => payload,
      };
    }

    throw new Error(`boom ${url}`);
  });

  assert.equal(result.provider, 'all');
  assert.equal(result.showtimes.length, 1);
  assert.ok(result.errors.length >= 5);
});

await run('normalizeLiveSnapshot dedupes same-title movies across providers', async () => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const {
      LIVE_SCHEDULES_TIMEOUT_MS,
      LIVE_TOHO_FALLBACK_TIMEOUT_MS,
      NEARBY_THEATER_RADIUS_KM,
      QUICKWATCH_DISTANCE_TIE_KM,
      compareQuickWatchShowtimes,
      getMovieVersionLabel,
      hasKnownTheaterLocation,
      isWithinNearbyRadius,
      normalizeLiveSnapshot,
      sortMoviesByRating,
    } = await vite.ssrLoadModule('/src/lib/app-data.ts');

    assert.ok(LIVE_SCHEDULES_TIMEOUT_MS >= 60_000);
    assert.equal(LIVE_TOHO_FALLBACK_TIMEOUT_MS, 15_000);
    assert.equal(NEARBY_THEATER_RADIUS_KM, 20);
    assert.equal(QUICKWATCH_DISTANCE_TIE_KM, 1);
    assert.equal(isWithinNearbyRadius(19.99), true);
    assert.equal(isWithinNearbyRadius(20), true);
    assert.equal(isWithinNearbyRadius(20.01), false);
    assert.equal(isWithinNearbyRadius(null), false);
    assert.equal(getMovieVersionLabel('Shared Movie \u5B57\u5E55\u7248'), '\u5B57\u5E55');
    assert.equal(getMovieVersionLabel('Shared Movie \u5439\u66FF\u7248'), '\u5439\u66FF');
    assert.equal(getMovieVersionLabel('Shared Movie'), '\u901A\u5E38');
    assert.deepEqual(
      sortMoviesByRating([
        { id: 'low', title: 'Low', rating: 3.8, ranking: 1 },
        { id: 'high', title: 'High', rating: 4.6, ranking: 20 },
        { id: 'none', title: 'None', ranking: 2 },
      ]).map((movie) => movie.id),
      ['high', 'low', 'none']
    );

    const normalized = normalizeLiveSnapshot({
      provider: 'all',
      chain: 'Multiple',
      theaters: [
        {
          code: '001',
          name: 'TOHO Sample',
          englishName: '',
          provider: 'toho',
          chain: 'TOHO Cinemas',
          scheduleUrl: 'https://example.test/toho/001',
          latitude: 35.6745,
          longitude: 139.7596,
          address: '',
        },
        {
          code: '001',
          name: 'AEON Sample',
          englishName: '',
          provider: 'aeon',
          chain: 'AEON Cinema',
          scheduleUrl: 'https://example.test/aeon/001',
          latitude: null,
          longitude: null,
          address: '',
        },
      ],
      movies: [
        {
          provider: 'toho',
          providerMovieCode: 'm1',
          title: 'Shared Movie',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: 'https://example.test/toho.jpg',
          theaterCode: '001',
        },
        {
          provider: 'aeon',
          providerMovieCode: 'm2',
          title: 'Shared Movie',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: 'https://example.test/aeon.jpg',
          theaterCode: '001',
        },
      ],
      showtimes: [
        {
          provider: 'toho',
          theaterCode: '001',
          theaterName: 'TOHO Sample',
          movieCode: 'm1',
          movieTitle: 'Shared Movie',
          screenCode: '1',
          screenName: 'Screen 1',
          startsAt: '2026-05-27T10:00:00+09:00',
          endsAt: '2026-05-27T12:00:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'toho-1',
          bookingUrl: 'https://example.test/toho/book',
        },
        {
          provider: 'aeon',
          theaterCode: '001',
          theaterName: 'AEON Sample',
          movieCode: 'm2',
          movieTitle: 'Shared Movie',
          screenCode: '2',
          screenName: 'Screen 2',
          startsAt: '2026-05-27T13:00:00+09:00',
          endsAt: '2026-05-27T15:00:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'aeon-1',
          bookingUrl: 'https://example.test/aeon/book',
        },
      ],
    });

    assert.equal(normalized.movies.length, 1);
    assert.equal(normalized.theaters.length, 2);
    assert.equal(normalized.showtimes.length, 2);
    assert.equal(
      hasKnownTheaterLocation(normalized.theaters.find((theater) => theater.id === 'toho-theater-001')),
      true
    );
    assert.equal(
      hasKnownTheaterLocation(normalized.theaters.find((theater) => theater.id === 'aeon-theater-001')),
      false
    );
    assert.deepEqual(
      new Set(normalized.theaters.map((theater) => theater.id)),
      new Set(['toho-theater-001', 'aeon-theater-001'])
    );
    assert.equal(
      normalized.theaters.find((theater) => theater.id === 'toho-theater-001').website_url,
      'https://example.test/toho/001'
    );
    assert.deepEqual(
      new Set(normalized.showtimes.map((showtime) => showtime.movie_id)),
      new Set([normalized.movies[0].id])
    );
    assert.equal(normalized.showtimes[0].booking_url, 'https://example.test/toho/book');
    assert.equal(normalized.showtimes[0].movie_version, '\u901A\u5E38');
    assert.equal(normalized.showtimes[0].raw_movie_title, 'Shared Movie');
    assert.deepEqual(normalized.movies[0].poster_urls, [
      'https://example.test/toho.jpg',
      'https://example.test/aeon.jpg',
    ]);

    const closeLater = {
      distance: 3,
      showtime: '2026-05-27T11:00:00+09:00',
      movie: { ranking: 999 },
    };
    const farSooner = {
      distance: 12,
      showtime: '2026-05-27T10:10:00+09:00',
      movie: { ranking: 1 },
    };
    const almostSameDistanceSooner = {
      distance: 3.5,
      showtime: '2026-05-27T10:00:00+09:00',
      movie: { ranking: 999 },
    };

    assert.equal(compareQuickWatchShowtimes(closeLater, farSooner) < 0, true);
    assert.equal(compareQuickWatchShowtimes(closeLater, almostSameDistanceSooner) > 0, true);
  } finally {
    await vite.close();
  }
});

await run('normalizeLiveSnapshot dedupes movie format variants', async () => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const { normalizeLiveSnapshot } = await vite.ssrLoadModule('/src/lib/app-data.ts');
    const normalized = normalizeLiveSnapshot({
      provider: 'all',
      chain: 'Multiple',
      theaters: [
        {
          code: '043',
          name: 'TOHO Shibuya',
          englishName: '',
          provider: 'toho',
          chain: 'TOHO Cinemas',
          scheduleUrl: '',
          latitude: 35.659,
          longitude: 139.697,
          address: '',
        },
        {
          code: 'futakotamagawa',
          name: '109 Futako',
          englishName: '',
          provider: '109',
          chain: '109 Cinemas',
          scheduleUrl: '',
          latitude: 35.6115,
          longitude: 139.6264,
          address: '',
        },
      ],
      movies: [
        {
          provider: 'toho',
          providerMovieCode: 'sw-dolby',
          title: 'スター・ウォーズ／マンダロリアン・アンド・グローグー（ＤｏｌｂｙＣＩＮＥＭＡ・字幕版）',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: 'https://example.test/sw-toho.jpg',
          theaterCode: '043',
        },
        {
          provider: '109',
          providerMovieCode: 'sw-4dx',
          title: '3D吹替4DX ｽﾀｰ･ｳｫｰｽﾞ ﾏﾝﾀﾞﾛﾘｱﾝ･ｱﾝﾄﾞ･ｸﾞﾛｰｸﾞｰ',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: 'https://example.test/sw-109.jpg',
          theaterCode: 'futakotamagawa',
        },
        {
          provider: 'toho',
          providerMovieCode: 'sw-truncated',
          title: 'スター・ウォーズ／マンダロリアン...',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: 'https://example.test/sw-truncated.jpg',
          theaterCode: '043',
        },
      ],
      showtimes: [
        {
          provider: 'toho',
          theaterCode: '043',
          theaterName: 'TOHO Shibuya',
          movieCode: 'sw-dolby',
          movieTitle: 'スター・ウォーズ／マンダロリアン・アンド・グローグー（ＤｏｌｂｙＣＩＮＥＭＡ・字幕版）',
          screenCode: '1',
          screenName: 'Screen 1',
          startsAt: '2026-05-28T09:20:00+09:00',
          endsAt: '2026-05-28T11:20:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'toho-1',
        },
        {
          provider: '109',
          theaterCode: 'futakotamagawa',
          theaterName: '109 Futako',
          movieCode: 'sw-4dx',
          movieTitle: '3D吹替4DX ｽﾀｰ･ｳｫｰｽﾞ ﾏﾝﾀﾞﾛﾘｱﾝ･ｱﾝﾄﾞ･ｸﾞﾛｰｸﾞｰ',
          screenCode: '2',
          screenName: 'Screen 2',
          startsAt: '2026-05-28T10:20:00+09:00',
          endsAt: '2026-05-28T12:20:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: '109-1',
        },
        {
          provider: 'toho',
          theaterCode: '043',
          theaterName: 'TOHO Shibuya',
          movieCode: 'sw-truncated',
          movieTitle: 'スター・ウォーズ／マンダロリアン...',
          screenCode: '3',
          screenName: 'Screen 3',
          startsAt: '2026-05-28T11:20:00+09:00',
          endsAt: '2026-05-28T13:20:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'toho-2',
        },
      ],
    });

    assert.equal(normalized.movies.length, 1);
    assert.equal(normalized.movies[0].title, 'スター・ウォーズ/マンダロリアン・アンド・グローグー');
    assert.equal(normalized.showtimes.length, 3);
    assert.deepEqual(
      new Set(normalized.showtimes.map((showtime) => showtime.movie_id)),
      new Set([normalized.movies[0].id])
    );
  } finally {
    await vite.close();
  }
});

await run('normalizeLiveSnapshot dedupes decorated Japanese movie titles', async () => {
  const vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const { normalizeLiveSnapshot } = await vite.ssrLoadModule('/src/lib/app-data.ts');
    const normalized = normalizeLiveSnapshot({
      provider: 'all',
      chain: 'Multiple',
      theaters: [
        {
          code: '043',
          name: 'TOHO Shibuya',
          englishName: '',
          provider: 'toho',
          chain: 'TOHO Cinemas',
          scheduleUrl: '',
          latitude: 35.659,
          longitude: 139.697,
          address: '',
        },
        {
          code: 'toyosu',
          name: 'United Toyosu',
          englishName: '',
          provider: 'united',
          chain: 'United Cinemas',
          scheduleUrl: '',
          latitude: 35.655,
          longitude: 139.796,
          address: '',
        },
      ],
      movies: [
        {
          provider: 'toho',
          providerMovieCode: 'quiz-toho',
          title: '映画『君のクイズ』',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: '',
          theaterCode: '043',
        },
        {
          provider: 'united',
          providerMovieCode: 'quiz-united',
          title: '君のクイズ',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: '',
          theaterCode: 'toyosu',
        },
        {
          provider: 'toho',
          providerMovieCode: 'conan-toho',
          title: '名探偵コナン ハイウェイの堕天使',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: '',
          theaterCode: '043',
        },
        {
          provider: 'united',
          providerMovieCode: 'conan-united',
          title: '劇場版「名探偵コナン ハイウェイの堕天使」',
          englishTitle: null,
          durationMinutes: 120,
          ratingCode: null,
          isNew: false,
          posterUrl: '',
          theaterCode: 'toyosu',
        },
      ],
      showtimes: [
        {
          provider: 'toho',
          theaterCode: '043',
          theaterName: 'TOHO Shibuya',
          movieCode: 'quiz-toho',
          movieTitle: '映画『君のクイズ』',
          screenCode: '1',
          screenName: 'Screen 1',
          startsAt: '2026-05-28T09:20:00+09:00',
          endsAt: '2026-05-28T11:20:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'toho-quiz',
        },
        {
          provider: 'united',
          theaterCode: 'toyosu',
          theaterName: 'United Toyosu',
          movieCode: 'quiz-united',
          movieTitle: '君のクイズ',
          screenCode: '2',
          screenName: 'Screen 2',
          startsAt: '2026-05-28T10:20:00+09:00',
          endsAt: '2026-05-28T12:20:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'united-quiz',
        },
        {
          provider: 'toho',
          theaterCode: '043',
          theaterName: 'TOHO Shibuya',
          movieCode: 'conan-toho',
          movieTitle: '名探偵コナン ハイウェイの堕天使',
          screenCode: '1',
          screenName: 'Screen 1',
          startsAt: '2026-05-28T13:20:00+09:00',
          endsAt: '2026-05-28T15:20:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'toho-conan',
        },
        {
          provider: 'united',
          theaterCode: 'toyosu',
          theaterName: 'United Toyosu',
          movieCode: 'conan-united',
          movieTitle: '劇場版「名探偵コナン ハイウェイの堕天使」',
          screenCode: '2',
          screenName: 'Screen 2',
          startsAt: '2026-05-28T14:20:00+09:00',
          endsAt: '2026-05-28T16:20:00+09:00',
          seatStatus: null,
          isLateShow: false,
          bookingCode: 'united-conan',
        },
      ],
    });

    assert.equal(normalized.movies.length, 2);
    assert.deepEqual(
      new Set(normalized.movies.map((movie) => movie.title)),
      new Set(['君のクイズ', '名探偵コナン ハイウェイの堕天使'])
    );
    assert.equal(normalized.showtimes.length, 4);
  } finally {
    await vite.close();
  }
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  buildTohoAccessUrl,
  buildTohoScheduleApiUrl,
  buildTohoPosterUrl,
  collectTohoSchedules,
  parseTohoAccessPage,
  parseTohoScheduleResponse,
  parseTohoTheaterList,
} from '../scripts/collectors/toho.js';

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
  });
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

if (process.exitCode) {
  process.exit(process.exitCode);
}

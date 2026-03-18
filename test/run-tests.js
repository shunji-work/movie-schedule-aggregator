import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  buildTohoScheduleApiUrl,
  collectTohoSchedules,
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

await run('parseTohoScheduleResponse normalizes movie and showtime data', async () => {
  const payload = JSON.parse(await fs.readFile('test/fixtures/toho-schedule.json', 'utf8'));
  const parsed = parseTohoScheduleResponse(payload, '2026-03-19');

  assert.equal(parsed.theater?.code, '009');
  assert.equal(parsed.movies.length, 1);
  assert.equal(parsed.showtimes.length, 1);
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
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

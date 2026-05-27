import { collect109Schedules } from './cinemas109.js';
import { collectAeonSchedules } from './aeon.js';
import { collectSmtSchedules } from './smt.js';
import { collectTjoySchedules } from './tjoy.js';
import { collectTohoSchedules } from './toho.js';
import { collectUnitedSchedules } from './united.js';

export const PROVIDER_ORDER = ['toho', 'aeon', 'united', '109', 'smt', 'tjoy'];

export const providerCollectors = {
  toho: collectTohoSchedules,
  aeon: collectAeonSchedules,
  united: collectUnitedSchedules,
  '109': collect109Schedules,
  smt: collectSmtSchedules,
  tjoy: collectTjoySchedules,
};

export async function collectProviderSchedules(
  provider,
  options = {},
  fetchImpl = fetch
) {
  const collector = providerCollectors[provider];

  if (!collector) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return collector(options, fetchImpl);
}

export async function collectAllSchedules(options = {}, fetchImpl = fetch) {
  const targetDate = options.date ?? new Date().toISOString().slice(0, 10);
  const snapshots = await Promise.all(
    PROVIDER_ORDER.map(async (provider) => {
      try {
        return await providerCollectors[provider](options, fetchImpl);
      } catch (error) {
        return {
          provider,
          chain: provider,
          date: targetDate,
          collectedAt: new Date().toISOString(),
          theaters: [],
          movies: [],
          showtimes: [],
          errors: [
            {
              provider,
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }
    })
  );

  return {
    provider: 'all',
    chain: 'Multiple',
    date: targetDate,
    collectedAt: new Date().toISOString(),
    providers: snapshots.map((snapshot) => ({
      provider: snapshot.provider,
      chain: snapshot.chain,
      theaterCount: snapshot.theaters.length,
      movieCount: snapshot.movies.length,
      showtimeCount: snapshot.showtimes.length,
    })),
    theaters: snapshots.flatMap((snapshot) => snapshot.theaters),
    movies: snapshots.flatMap((snapshot) =>
      snapshot.movies.map((movie) => ({
        ...movie,
        provider: movie.provider ?? snapshot.provider,
      }))
    ),
    showtimes: snapshots.flatMap((snapshot) => snapshot.showtimes),
    errors: snapshots.flatMap((snapshot) => snapshot.errors ?? []),
  };
}

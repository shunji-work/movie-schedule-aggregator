import {
  collectAllSchedules,
  collectProviderSchedules,
  PROVIDER_ORDER,
} from '../scripts/collectors/index.js';

function getTokyoDate() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default async function handler(request, response) {
  try {
    const date = typeof request.query?.date === 'string' ? request.query.date : getTokyoDate();
    const provider =
      typeof request.query?.provider === 'string' ? request.query.provider : 'all';

    if (provider !== 'all' && !PROVIDER_ORDER.includes(provider)) {
      response.status(400).json({
        error: `Unsupported provider: ${provider}`,
      });
      return;
    }

    const result =
      provider === 'all'
        ? await collectAllSchedules({ date })
        : await collectProviderSchedules(provider, { date });

    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

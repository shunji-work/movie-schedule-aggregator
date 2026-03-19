import { collectTohoSchedules } from '../scripts/collectors/toho.js';

export default async function handler(request, response) {
  try {
    const date =
      typeof request.query?.date === 'string'
        ? request.query.date
        : new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date());

    const result = await collectTohoSchedules({ date });

    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

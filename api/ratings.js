import { fetchFilmarksRating } from '../scripts/ratings/filmarks.js';

const MAX_TITLES_PER_REQUEST = 25;

function parseTitles(request) {
  const raw = request.query?.titles;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return raw.split(',');
    }
  }

  if (Array.isArray(raw)) {
    return raw;
  }

  const title = request.query?.title;
  if (typeof title === 'string') {
    return [title];
  }

  if (Array.isArray(title)) {
    return title;
  }

  return [];
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export default async function handler(request, response) {
  try {
    const titles = [...new Set(parseTitles(request).map((title) => String(title).trim()).filter(Boolean))]
      .slice(0, MAX_TITLES_PER_REQUEST);

    if (!titles.length) {
      response.status(400).json({ error: 'No titles provided' });
      return;
    }

    const ratings = await mapLimit(titles, 3, async (title) => {
      try {
        return await fetchFilmarksRating(title);
      } catch (error) {
        return {
          title,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    response.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=604800');
    response.status(200).json({
      ratings: ratings.filter(Boolean),
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

const FILMARKS_SEARCH_URL = 'https://filmarks.com/search/movies';
const USER_AGENT = 'movie-schedule-aggregator/1.0';

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripTags(value = '') {
  return decodeEntities(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function normalizeRatingTitle(title = '') {
  return String(title)
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\uFF08][^\uFF09]*[\uFF09]/g, ' ')
    .replace(/[\u3010][^\u3011]*[\u3011]/g, ' ')
    .replace(/[\u300E\u300F\u300C\u300D]/g, ' ')
    .replace(/^\s*\u6620\u753B(?=\s|[\u300E\u300F\u300C\u300D])/g, ' ')
    .replace(/^\s*\u5287\u5834\u7248\s*/g, ' ')
    .replace(/(?:dolby\s*cinema|dolby\s*atmos|screenx|imax|mx4d|4dx|atmos|uhd|4k|3d|2d)/gi, ' ')
    .replace(/(?:\u5B57\u5E55\u7248?|\u5439\u66FF\u7248?|\u65E5\u672C\u8A9E\u7248?|\u82F1\u8A9E\u7248?)/g, ' ')
    .replace(/[\s\u3000\u30FB\uFF65\uFF0F/:：,，、。"'“”‘’&＆\-‐‑‒–—―_+＋=＝~〜～.]+/g, '')
    .toLowerCase();
}

function parseSearchResultItems(html) {
  const items = [];
  const cassettePattern =
    /<div\b(?=[^>]*class="(?:[^"]*\s)?p-content-cassette(?:\s[^"]*)?")[^>]*>[\s\S]*?(?=<div\b(?=[^>]*class="(?:[^"]*\s)?p-content-cassette(?:\s[^"]*)?")[^>]*>|<div class="c-pagination|<\/main>|$)/g;
  const blocks = html.match(cassettePattern) ?? [];

  for (const block of blocks) {
    const title = stripTags(block.match(/<h3 class="p-content-cassette__title">([\s\S]*?)<\/h3>/)?.[1] ?? '');
    const ratingValue = block.match(/<div class="c-rating__score">([\d.]+)<\/div>/)?.[1] ?? '';
    const rating = Number(ratingValue);
    const href = block.match(/href="(\/movies\/\d+)"/)?.[1] ?? '';

    if (!title || !Number.isFinite(rating) || rating <= 0) {
      continue;
    }

    items.push({
      title,
      rating,
      source: 'Filmarks',
      url: href ? `https://filmarks.com${href}` : undefined,
      normalizedTitle: normalizeRatingTitle(title),
    });
  }

  return items;
}

export function parseFilmarksSearchHtml(html, queryTitle) {
  const queryKey = normalizeRatingTitle(queryTitle);
  const items = parseSearchResultItems(html);

  if (!items.length) {
    return null;
  }

  return (
    items.find((item) => item.normalizedTitle === queryKey) ??
    items.find((item) => item.normalizedTitle.includes(queryKey) || queryKey.includes(item.normalizedTitle)) ??
    items[0]
  );
}

export async function fetchFilmarksRating(title, fetchImpl = fetch) {
  const url = new URL(FILMARKS_SEARCH_URL);
  url.searchParams.set('q', title);

  const response = await fetchImpl(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Filmarks request failed: ${response.status}`);
  }

  const html = await response.text();
  const result = parseFilmarksSearchHtml(html, title);

  if (!result) {
    return null;
  }

  return {
    title,
    rating: result.rating,
    source: result.source,
    url: result.url,
    matchedTitle: result.title,
  };
}

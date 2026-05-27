export const PROVIDER_CHAINS = {
  toho: 'TOHO Cinemas',
  aeon: 'AEON Cinema',
  united: 'United Cinemas',
  '109': '109 Cinemas',
  smt: 'MOVIX / Piccadilly',
  tjoy: 'T-Joy',
};

export const USER_AGENT = 'movie-schedule-aggregator/1.0';

export function toYmd(date) {
  return date.replaceAll('-', '');
}

export function fromYmd(value) {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function normalizeWhitespace(value = '') {
  return decodeEntities(stripTags(String(value))).replace(/\s+/g, ' ').trim();
}

export function stripTags(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

export function decodeEntities(value = '') {
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

export function absoluteUrl(url, base) {
  if (!url) {
    return '';
  }

  return new URL(decodeEntities(url), base).toString();
}

export function getAttr(html, name) {
  return html.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))?.[1] ?? '';
}

function safeTextDecoder(charset) {
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder('utf-8');
  }
}

function charsetFromContentType(contentType = '') {
  return contentType.match(/charset=["']?([^"';\s]+)/i)?.[1]?.toLowerCase() ?? '';
}

function charsetFromHtml(html = '') {
  return html.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i)?.[1]?.toLowerCase() ?? '';
}

export function decodeResponseText(buffer, contentType = '', preferredCharset = '') {
  const hintedCharset = preferredCharset || charsetFromContentType(contentType);

  if (hintedCharset) {
    return safeTextDecoder(hintedCharset).decode(buffer);
  }

  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  const htmlCharset = charsetFromHtml(utf8Text);

  if (htmlCharset && htmlCharset !== 'utf-8') {
    return safeTextDecoder(htmlCharset).decode(buffer);
  }

  return utf8Text;
}

export async function fetchText(url, fetchImpl = fetch, { charset } = {}) {
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText ?? ''} for ${url}`);
  }

  const buffer = await response.arrayBuffer();
  return decodeResponseText(buffer, response.headers?.get?.('content-type') ?? '', charset);
}

export async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText ?? ''} for ${url}`);
  }

  return response.json();
}

export function durationTextToMinutes(value = '') {
  const text = String(value);
  const minutes = text.match(/(\d+)\s*分/)?.[1];
  if (minutes) {
    return Number(minutes);
  }

  const iso = text.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (iso) {
    return (Number(iso[1] ?? 0) * 60) + Number(iso[2] ?? 0);
  }

  return 0;
}

function formatJstParts(date) {
  const localMs = date.getTime() + 9 * 60 * 60 * 1000;
  const local = new Date(localMs);
  const year = `${local.getUTCFullYear()}`;
  const month = `${local.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${local.getUTCDate()}`.padStart(2, '0');
  const hour = `${local.getUTCHours()}`.padStart(2, '0');
  const minute = `${local.getUTCMinutes()}`.padStart(2, '0');
  return { year, month, day, hour, minute };
}

export function isoUtcToJst(value) {
  const parts = formatJstParts(new Date(value));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00+09:00`;
}

export function buildJstDateTime(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = String(time).replace(/[^\d:]/g, '').split(':').map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return `${date}T00:00:00+09:00`;
  }

  const utcMs = Date.UTC(year, month - 1, day, -9, 0) + (hour * 60 + minute) * 60 * 1000;
  const parts = formatJstParts(new Date(utcMs));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00+09:00`;
}

export function stableCode(value) {
  let hash = 0;
  for (const char of String(value)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash.toString(36);
}

export function createEmptySnapshot(provider, date) {
  return {
    provider,
    chain: PROVIDER_CHAINS[provider] ?? provider,
    date,
    collectedAt: new Date().toISOString(),
    theaters: [],
    movies: [],
    showtimes: [],
  };
}

export function uniqueBy(items, getKey) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
}

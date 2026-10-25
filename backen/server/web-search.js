const SEARCH_URL = 'https://html.duckduckgo.com/html/';
const MAX_QUERY_LENGTH = 300;
const MAX_RESULTS = 8;

function decodeHtml(value) {
  return value
    .replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (entity, numeric, named) => {
      if (numeric) {
        const codePoint = numeric[0].toLowerCase() === 'x'
          ? Number.parseInt(numeric.slice(1), 16)
          : Number.parseInt(numeric, 10);
        return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }
      return {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: ' ',
      }[named.toLowerCase()] ?? entity;
    });
}

function textFromHtml(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function destinationFromHref(href) {
  const url = new URL(decodeHtml(href), SEARCH_URL);
  const destination = url.searchParams.get('uddg');
  const resultUrl = destination ? new URL(destination) : url;
  if (!['http:', 'https:'].includes(resultUrl.protocol)) return null;
  return resultUrl.toString();
}

function parseResults(html) {
  const anchors = [...html.matchAll(
    /<a\b([^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi,
  )];

  return anchors.slice(0, MAX_RESULTS).flatMap((match, index) => {
    const href = match[1].match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) return [];

    let url;
    try {
      url = destinationFromHref(href);
    } catch {
      return [];
    }
    if (!url) return [];

    const nextStart = anchors[index + 1]?.index ?? html.length;
    const block = html.slice(match.index, nextStart);
    const snippetMatch = block.match(
      /<(?:a|div)\b[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i,
    );

    return [{
      title: textFromHtml(match[2]) || url,
      url,
      snippet: snippetMatch ? textFromHtml(snippetMatch[1]) : '',
    }];
  });
}

export async function searchWeb(rawQuery) {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (!query || query.length > MAX_QUERY_LENGTH) {
    throw new Error(`La consulta debe tener entre 1 y ${MAX_QUERY_LENGTH} caracteres.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${SEARCH_URL}?q=${encodeURIComponent(query)}`, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (compatible; SofiaSearch/1.0)',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`El buscador respondió HTTP ${response.status}.`);
    return parseResults(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

import { TITLE_REJECT } from './dishPhotos';

/**
 * Reading a Wikimedia Commons search result.
 *
 * Commons search is a text index over file names and descriptions, so a query
 * for a soup returns the cookbook cover, the restaurant sign and the vegetable
 * patch beside the bowl. The payload is also loose: a page may have no
 * imageinfo at all, and the credit fields arrive as HTML. Both problems are
 * dealt with here, once, rather than anywhere a photograph is shown.
 */

export interface CommonsFile {
  readonly title: string;
  readonly thumb: string;
  readonly width: number;
  readonly mime: string;
  readonly author: string;
  readonly license: string;
  readonly page: string;
}

/** Strips the anchor markup Commons wraps author names in. */
function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function commonsFiles(payload: unknown): CommonsFile[] {
  const pages = (payload as { query?: { pages?: unknown[] } } | null)?.query?.pages;
  if (!Array.isArray(pages)) return [];
  const out: CommonsFile[] = [];
  for (const raw of pages) {
    const page = raw as { title?: unknown; imageinfo?: unknown[] };
    const info = Array.isArray(page.imageinfo) ? (page.imageinfo[0] as Record<string, unknown>) : null;
    if (!info) continue;
    const thumb = typeof info.thumburl === 'string' ? info.thumburl : typeof info.url === 'string' ? info.url : '';
    if (thumb === '') continue;
    const meta = (info.extmetadata ?? {}) as Record<string, { value?: unknown }>;
    out.push({
      title: String(page.title ?? ''),
      thumb,
      width: Number(info.width) || 0,
      mime: String(info.mime ?? ''),
      author: plain(String(meta.Artist?.value ?? '')),
      license: plain(String(meta.LicenseShortName?.value ?? '')),
      page: typeof info.descriptionurl === 'string' ? info.descriptionurl : '',
    });
  }
  return out;
}

/**
 * Picks the file that is most likely to be the dish.
 *
 * Commons search is a text index over file names and descriptions, so a
 * query for a soup returns the cookbook cover and the vegetable patch beside
 * the bowl. Requiring the dish's own word in the title, and refusing the
 * words that mark a sign or an ingredient shot, throws most of that out.
 */
export function pick(list: readonly CommonsFile[], must: readonly string[]): CommonsFile | null {
  let best: CommonsFile | null = null;
  let bestScore = 0;
  for (const item of list) {
    if (!/^image\/(jpeg|png|webp)$/.test(item.mime)) continue;
    if (item.width > 0 && item.width < 420) continue;
    const title = item.title.toLowerCase();
    if (TITLE_REJECT.some((word) => title.includes(word))) continue;
    const hits = must.filter((word) => title.includes(word)).length;
    if (hits === 0) continue;
    const score = hits * 100 + Math.min(item.width, 4000) / 1000;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}


/** Reads a Commons response and returns the one file worth showing, if any. */
export function chooseCommonsFile(payload: unknown, must: readonly string[]): CommonsFile | null {
  return pick(commonsFiles(payload), must);
}

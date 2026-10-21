import { REJECT_PHRASES, REJECT_WORDS } from './dishPhotos';

/**
 * Reading a Wikimedia Commons search result.
 *
 * Commons search is a text index over file names, descriptions and
 * categories, so a query for a soup returns the cookbook cover, the
 * restaurant sign and the vegetable patch beside the bowl. The payload is
 * also loose: a page may have no imageinfo at all, and the credit fields
 * arrive as HTML. Both problems are dealt with here, once, rather than
 * anywhere a photograph is shown.
 *
 * The first version matched the dish's word against the file NAME alone, and
 * that is why most cards stayed drawn: a large share of Commons food
 * photography is named in German, French, Polish or Russian, or named
 * nothing at all — «File:2019-01-05 Mittagessen.jpg» is a perfectly good
 * lentil soup that no English token will ever match. Search finds those
 * files, because the index covers the description page; only the filter
 * threw them away. So the haystack is now the name plus the caption, the
 * description and the categories, with a name match still worth more.
 */

export interface CommonsFile {
  readonly title: string;
  readonly thumb: string;
  readonly width: number;
  readonly mime: string;
  readonly author: string;
  readonly license: string;
  readonly page: string;
  /** Name, caption, description and categories, lowercased — what tokens match. */
  readonly haystack: string;
}

/** Why no photograph came back, so the profile can say something truthful. */
export type PickFailure = 'нет результатов' | 'ничего не подошло';

/** Strips the markup Commons wraps author names and descriptions in. */
function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
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
    const title = String(page.title ?? '');
    const described = [
      title,
      plain(String(meta.ObjectName?.value ?? '')),
      plain(String(meta.ImageDescription?.value ?? '')),
      plain(String(meta.Categories?.value ?? '')).replace(/\|/g, ' '),
    ].join(' ');
    out.push({
      title,
      thumb,
      width: Number(info.width) || 0,
      mime: String(info.mime ?? ''),
      author: plain(String(meta.Artist?.value ?? '')),
      license: plain(String(meta.LicenseShortName?.value ?? '')),
      page: typeof info.descriptionurl === 'string' ? info.descriptionurl : '',
      haystack: described.toLowerCase(),
    });
  }
  return out;
}

/**
 * Junk words are matched on the file name only.
 *
 * A description mentioning a market or a field says nothing about what is in
 * the frame — the photograph of a bowl of lentils can perfectly well be
 * described as bought at a market. The name is where a sign, a map or a
 * diagram announces itself.
 */
function isJunk(title: string): boolean {
  if (REJECT_PHRASES.some((phrase) => title.includes(phrase))) return true;
  // Word, not substring: the title is split on everything that is not a
  // letter or a digit, which keeps `raw` from matching `strawberry`.
  const words = new Set(title.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  return REJECT_WORDS.some((word) => words.has(word));
}

export interface Picked {
  readonly file: CommonsFile;
  readonly score: number;
}

/**
 * Picks the file most likely to be the dish.
 *
 * Search rank carries real information — Commons put the best text match
 * first — so position is worth a few points, enough to break ties but never
 * enough to beat a genuine name match further down.
 */
export function pick(
  list: readonly CommonsFile[],
  must: readonly string[],
  taken: ReadonlySet<string> = new Set(),
): Picked | null {
  let best: Picked | null = null;
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    // Neighbouring dishes share tokens — both tuna salads match «tuna» — so
    // the best file for one is often the best file for the other. Taking the
    // runner-up keeps two cards from showing the same plate.
    if (taken.has(item.thumb)) continue;
    if (!/^image\/(jpeg|png|webp)$/.test(item.mime)) continue;
    if (item.width > 0 && item.width < 420) continue;
    const title = item.title.toLowerCase();
    if (isJunk(title)) continue;
    const inTitle = must.filter((word) => title.includes(word)).length;
    const inAny = must.filter((word) => item.haystack.includes(word)).length;
    if (inAny === 0) continue;
    const rank = Math.max(0, 20 - index);
    const score = inTitle * 100 + inAny * 40 + rank + Math.min(item.width, 4000) / 1000;
    if (best === null || score > best.score) best = { file: item, score };
  }
  return best;
}

/**
 * Reads a Commons response and returns the one file worth showing, or why
 * none was. The reason is kept because a dish with no results needs a
 * different query, and a dish whose results were all filtered out needs
 * different tokens — from here they look identical.
 */
export function chooseCommonsFile(
  payload: unknown,
  must: readonly string[],
  taken: ReadonlySet<string> = new Set(),
): { readonly file: CommonsFile } | { readonly failure: PickFailure } {
  const files = commonsFiles(payload);
  if (files.length === 0) return { failure: 'нет результатов' };
  const picked = pick(files, must, taken);
  // Rather than leave a card empty for the sake of the rule, a dish that has
  // no candidate of its own falls back to the shared one.
  const chosen = picked ?? pick(files, must);
  return chosen === null ? { failure: 'ничего не подошло' } : { file: chosen.file };
}

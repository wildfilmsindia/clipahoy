import 'server-only';

import { getAllClips, getPlace } from './archive';
import type { Clip } from './types';

/**
 * Full-text search over clip title + description prose, ranked by BM25.
 *
 * AUDIT.md §G found the previous approach returned candidates in index order
 * with no ranking at all: "Delhi railway station" surfaced 800 clips and the
 * top ten were whichever Delhi clips happened to come first, mostly with no
 * railway in them. Two causes, both fixed here:
 *
 *   1. No relevance ranking. BM25 now scores term rarity and saturation, so a
 *      clip matching "railway" outranks one that merely matches "Delhi" a
 *      dozen times.
 *   2. Place dominance. Searching the tag fields let a common place name
 *      swamp the subject the user actually asked for. We now index title and
 *      prose ONLY — the text a human wrote about the footage — and never the
 *      place/subject tags in isolation.
 */

const K1 = 1.5; // term-frequency saturation
const B = 0.75; // length normalisation
const TITLE_WEIGHT = 3; // a term in the title counts triple

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that',
  'from', 'by', 'as', 'my', 'our', 'their', 'his', 'her', 'i', 'we', 'you',
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** Light suffix stripping. A full stemmer would mangle Indian place names. */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

type Doc = { clip: Clip; len: number; tf: Map<string, number> };

type Index = {
  docs: Doc[];
  df: Map<string, number>;
  avgLen: number;
};

let index: Index | null = null;

function build(): Index {
  const docs: Doc[] = [];
  const df = new Map<string, number>();
  let totalLen = 0;

  for (const clip of getAllClips()) {
    const tf = new Map<string, number>();

    // Title terms are counted TITLE_WEIGHT times, which is how field
    // weighting is expressed inside a single-field BM25.
    for (const t of tokenise(clip.title)) {
      tf.set(t, (tf.get(t) ?? 0) + TITLE_WEIGHT);
    }
    for (const t of tokenise(clip.text ?? '')) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    if (tf.size === 0) continue;

    let len = 0;
    for (const n of tf.values()) len += n;
    totalLen += len;

    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
    docs.push({ clip, len, tf });
  }

  return { docs, df, avgLen: docs.length ? totalLen / docs.length : 0 };
}

function getIndex(): Index {
  if (!index) index = build();
  return index;
}

/** Build the index eagerly so the first search doesn't pay for it. */
export function warmIndex(): void {
  getIndex();
}

export type Hit = { clip: Clip; score: number };

export function search(query: string, limit = 60): Hit[] {
  const terms = tokenise(query);
  if (terms.length === 0) return [];

  const { docs, df, avgLen } = getIndex();
  const N = docs.length;

  // Require a majority of query terms so a two-word query isn't answered by
  // clips matching only its commonest word — the failure AUDIT.md §G recorded
  // for "Mumbai monsoon" and "Rajasthan village".
  const required = terms.length <= 2 ? terms.length : Math.ceil(terms.length * 0.6);

  const hits: Hit[] = [];

  for (const doc of docs) {
    let score = 0;
    let matched = 0;

    for (const term of terms) {
      const f = doc.tf.get(term);
      if (!f) continue;
      matched++;

      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (doc.len / avgLen))));
    }

    if (matched >= required && score > 0) hits.push({ clip: doc.clip, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** How many clips a query can reach, for showing an honest total. */
export function countMatches(query: string): number {
  return search(query, Number.MAX_SAFE_INTEGER).length;
}

/**
 * Clips for one place, best-described first (longer titles read better).
 *
 * Returns the true total alongside the page, so the UI can say how much the
 * archive actually holds rather than reporting its own page size back as if
 * it were the count.
 */
export function clipsForPlace(placeId: string, limit = 60): { clips: Clip[]; total: number } {
  const place = getPlace(placeId);
  if (!place) return { clips: [], total: 0 };

  const all = getAllClips()
    .filter((c) => c.placeId === placeId)
    .sort((a, b) => b.title.length - a.title.length);

  return { clips: all.slice(0, limit), total: all.length };
}

import 'server-only';

import { getAllClips, getPlace, indiaFirst } from './archive';
import { SUBJECTS, type Clip, type Subject } from './types';

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

/*
 * Tuning constants. Overridable by env so scripts/benchmark.ts can sweep them
 * without editing source; production always uses the defaults below.
 */
const K1 = Number(process.env.BM25_K1 ?? 1.5); // term-frequency saturation
const B = Number(process.env.BM25_B ?? 0.75); // length normalisation
const TITLE_WEIGHT = Number(process.env.BM25_TITLE_WEIGHT ?? 3); // title counts triple

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

/** How many documents contain a term. Diagnostic. */
export function termFrequency(term: string): number {
  return getIndex().df.get(term) ?? 0;
}

/** Distinct indexed terms. Used to size the spelling-correction search. */
export function vocabularySize(): number {
  return getIndex().df.size;
}

export type Hit = { clip: Clip; score: number };

/**
 * Personal names that collide with places and monuments people search for.
 *
 * Lives here, not in the recommender, so BOTH paths get it. It was originally
 * added to the personalised feed only, which meant typing "Meenakshi" into the
 * onboarding returned the temple while typing it into /search still returned
 * the actress — the two paths had silently drifted apart.
 *
 * `bare` matches only the one-word query. Someone searching "Meenakshi
 * Seshadri" or "Mount Kailash" has already disambiguated and is left alone.
 * `personal` matches only the full personal-name form, so the exclusion stays
 * tiny: 10 clips for Seshadri, 25 for Kailash Kher.
 */
const NAME_COLLISIONS: { bare: RegExp; personal: RegExp }[] = [
  { bare: /^meenakshi$/i, personal: /meenakshi\s+sh?eshadri/i },
  { bare: /^kailash$/i, personal: /kailash\s+(?:kher|ji\b)/i },
];

/* ----------------------------- spelling repair ---------------------------- */

/**
 * Candidate words for spelling correction, bucketed by their first two letters.
 *
 * 91,536 distinct terms is far too many to measure edit distance against on
 * every query, but a typo almost never lands on the first two characters —
 * "keralla"/"kerala", "mumbay"/"mumbai", "elefant"/"elephant", "biriyani"/
 * "biryani" all agree there. Bucketing turns a 91k scan into a few hundred
 * comparisons.
 *
 * Only reasonably common words are candidates. Correcting toward a word that
 * appears twice in the corpus trades a query that found nothing for one that
 * finds almost nothing, and risks "fixing" a rare but correct spelling.
 */
let spellBuckets: Map<string, string[]> | null = null;

function candidateBuckets(): Map<string, string[]> {
  if (spellBuckets) return spellBuckets;

  const { df } = getIndex();
  const map = new Map<string, string[]>();
  for (const [term, n] of df) {
    if (term.length < 4 || n < 8) continue;
    const key = term.slice(0, 2);
    const bucket = map.get(key);
    if (bucket) bucket.push(term);
    else map.set(key, [term]);
  }
  spellBuckets = map;
  return map;
}

/** Levenshtein distance, abandoned as soon as it exceeds `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/**
 * How rare a term has to be before we suspect it is a typo.
 *
 * Not zero. Uploaders make the same slips visitors do — "Hornbil Festival"
 * appears in a real title, "rajastan" in two, "monsson" in one — so a term can
 * exist in the index and still be a mistake. Correcting "rajastan" (2 clips)
 * to "rajasthan" (4,978) is obviously right; the threshold stays low enough
 * that a genuinely rare correct word is left alone.
 */
const TYPO_MAX_DF = 3;

/**
 * The indexed word a mistyped one most likely meant, or null.
 *
 * Candidates are scored by frequency divided by edit distance, not by distance
 * alone. "elefant" is one edit from "elegant" (620 clips) and two from
 * "elephant" (1,745) — distance alone picks the elegant birds, which is not
 * what anyone typing "elefant" wants. Weighting by how much the archive
 * actually uses a word picks the elephants.
 */
export function correctSpelling(term: string): string | null {
  const { df } = getIndex();
  if (term.length < 4 || (df.get(term) ?? 0) > TYPO_MAX_DF) return null;

  const max = term.length >= 7 ? 2 : 1;
  const pool = candidateBuckets().get(term.slice(0, 2)) ?? [];
  const own = df.get(term) ?? 0;

  let best: string | null = null;
  let bestScore = 0;

  for (const candidate of pool) {
    if (candidate === term) continue;
    const d = editDistance(term, candidate, max);
    if (d > max) continue;

    const freq = df.get(candidate) ?? 0;
    // A correction has to be clearly better than what was typed, or leave it.
    if (freq < Math.max(own * 8, 8)) continue;

    const score = freq / d;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export function search(query: string, limit = 60): Hit[] {
  const raw = tokenise(query);
  if (raw.length === 0) return [];

  const { docs, df, avgLen } = getIndex();

  /*
   * Repair words the index has never seen. "keralla", "mumbay" and "biriyani"
   * each returned nothing at all before this; a query that finds zero results
   * because of one slipped key is the worst outcome the search can produce.
   * Correctly spelled terms are left untouched — correction only ever fires on
   * a term with no postings.
   */
  const terms = raw.map((t) => correctSpelling(t) ?? t);
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

  const collision = NAME_COLLISIONS.find((c) => c.bare.test(query.trim()));
  if (collision) {
    return hits
      .filter((h) => !collision.personal.test(`${h.clip.title} ${h.clip.text ?? ''}`))
      .slice(0, limit);
  }

  return hits.slice(0, limit);
}

/** How many clips a query can reach, for showing an honest total. */
export function countMatches(query: string): number {
  return search(query, Number.MAX_SAFE_INTEGER).length;
}

/**
 * Paged search, so results are not silently truncated at a fixed cap.
 * Returns the true total alongside the page.
 */
export function searchPage(
  query: string,
  offset = 0,
  limit = 24,
): { hits: Hit[]; total: number } {
  const all = search(query, Number.MAX_SAFE_INTEGER);
  return { hits: all.slice(offset, offset + limit), total: all.length };
}

/**
 * Clips carrying a subject tag, newest-looking first.
 *
 * The 34-tag vocabulary was previously invisible in the UI even though every
 * clip is tagged with it — this is what makes browse-by-subject possible.
 */
export function clipsForSubject(
  subject: Subject,
  offset = 0,
  limit = 24,
): { clips: Clip[]; total: number } {
  /*
   * India-first ordering is applied to the WHOLE set before slicing.
   *
   * It used to be applied by the page component to the 24 clips it had just
   * received, which only reordered within that page — so /subject/railway
   * page 1 led with Sahibabad Junction but page 2 could still open on an
   * Amsterdam metro. Sorting here means foreign footage collects at the end of
   * the whole subject rather than at the top of every page.
   */
  const all = indiaFirst(getAllClips().filter((c) => c.subjects.includes(subject)));
  return { clips: all.slice(offset, offset + limit), total: all.length };
}

/** Clip counts per subject, for the browse grid. Computed once. */
let subjectCounts: { subject: Subject; count: number }[] | null = null;

export function getSubjectCounts(): { subject: Subject; count: number }[] {
  if (subjectCounts) return subjectCounts;

  const tally = new Map<Subject, number>();
  for (const clip of getAllClips()) {
    for (const s of clip.subjects) tally.set(s, (tally.get(s) ?? 0) + 1);
  }

  subjectCounts = SUBJECTS.map((subject) => ({
    subject,
    count: tally.get(subject) ?? 0,
  }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return subjectCounts;
}

/**
 * Other clips from the same place, for the detail page. Excludes the clip
 * itself so a viewer never sees what they are already watching.
 */
export function relatedClips(clip: Clip, limit = 6): Clip[] {
  const pool = clip.placeId
    ? getAllClips().filter((c) => c.placeId === clip.placeId && c.id !== clip.id)
    : getAllClips().filter(
        (c) => c.id !== clip.id && c.subjects.some((s) => clip.subjects.includes(s)),
      );

  /*
   * Rank by resemblance, not array order.
   *
   * This used to `slice(0, limit)` straight off the filter, so "More from Goa"
   * on a clip of rice fields opened with two celebrity interviews that merely
   * carried a Goa tag. Sharing subjects with the clip being watched is the
   * cheapest available measure of "more like this one", and a longer
   * description is a decent tiebreak for which of two equals was better
   * documented.
   */
  const wanted = new Set(clip.subjects);
  return pool
    .map((c) => ({
      clip: c,
      shared: c.subjects.reduce((n, s) => n + (wanted.has(s) ? 1 : 0), 0),
    }))
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        (b.clip.text?.length ?? 0) - (a.clip.text?.length ?? 0),
    )
    .slice(0, limit)
    .map((r) => r.clip);
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

/**
 * How specific a phrase is, as a multiplier for relevance boosting elsewhere.
 *
 * Reads the same document frequencies BM25 already builds; it does not affect
 * matching. Exists because a personalised feed blends several signals, and
 * without it every typed word counted the same: "Hornbill Festival" reduced to
 * the `festival` tag plus the word "festival", which appears in ~12,000 clips,
 * so a generic Kolkata festival outranked the actual Nagaland one.
 *
 * The RAREST token carries the phrase. "ganesh chaturthi" is as specific as
 * "chaturthi", not as vague as its commoner half.
 *
 * Bounds are deliberate: even a very common word keeps some pull (0.35), and
 * a hapax cannot run away with the ranking (1.6).
 */
const IDF_REFERENCE = 4.5; // a moderately specific term, ~500 documents

export function termRarity(phrase: string): number {
  const { docs, df } = getIndex();
  const N = docs.length;
  const tokens = tokenise(phrase);
  if (tokens.length === 0) return 1;

  let rarest = 0;
  for (const token of tokens) {
    const n = df.get(token) ?? 0;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
    if (idf > rarest) rarest = idf;
  }

  return Math.min(1.6, Math.max(0.35, rarest / IDF_REFERENCE));
}

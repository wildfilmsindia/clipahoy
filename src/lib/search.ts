import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

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

/**
 * An inverted index: term -> the documents containing it.
 *
 * This used to be a FORWARD index — one `Map<string, number>` per clip, so
 * 108,148 Maps holding term strings. Measured, that structure cost 545 MB, 58%
 * of the process, for the same information stored here in typed arrays. Two
 * things were expensive: per-entry Map overhead at roughly 14 million entries,
 * and no way to share a term across the documents that contain it.
 *
 * Postings are parallel `Int32Array`s rather than objects, so each posting is
 * 8 bytes with no per-object header.
 *
 * It is also faster to query. The old shape forced a scan of all 108k
 * documents per search, testing each for every query term; this walks only the
 * documents that actually contain a term.
 */
/**
 * Where one term's postings sit inside the shared buffers.
 *
 * Two numbers, not two arrays. An earlier version gave every term its own pair
 * of Int32Arrays, which meant 183,000 typed-array objects — each carrying its
 * own header and backing store — and measured 423 MB. Concatenating every
 * term's postings into two buffers and storing only offsets removes all of
 * that per-term overhead.
 */
type Slice = { start: number; end: number };

type Index = {
  /** Indexed clips, addressed by the doc ids held in the postings. */
  clips: Clip[];
  /** Term count per document, for BM25 length normalisation. */
  lens: Int32Array;
  /** Document frequency per term — IDF, and the spelling-correction vocabulary. */
  df: Map<string, number>;
  /** term -> its span in the two buffers below. */
  slices: Map<string, Slice>;
  /** Every posting, all terms concatenated. */
  postingDocs: Int32Array;
  /**
   * Term frequencies, as 16-bit. The highest count in this corpus is well
   * under 65,535 — a title term is worth TITLE_WEIGHT (3) and prose is capped
   * at 800 characters — so half the width is free.
   */
  postingFreqs: Uint16Array;
  avgLen: number;
};

let index: Index | null = null;

function build(): Index {
  const clips: Clip[] = [];
  const lens: number[] = [];

  // Gathered per term first, then flattened. The totals are not known until
  // every document has been read.
  const collected = new Map<string, { docs: number[]; freqs: number[] }>();
  let totalLen = 0;
  let totalPostings = 0;

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

    const docId = clips.length;
    clips.push(clip);

    let len = 0;
    for (const [term, freq] of tf) {
      len += freq;
      totalPostings++;
      const bucket = collected.get(term);
      if (bucket) {
        bucket.docs.push(docId);
        bucket.freqs.push(freq);
      } else {
        collected.set(term, { docs: [docId], freqs: [freq] });
      }
    }
    lens.push(len);
    totalLen += len;
  }

  const postingDocs = new Int32Array(totalPostings);
  const postingFreqs = new Uint16Array(totalPostings);
  const slices = new Map<string, Slice>();
  const df = new Map<string, number>();

  let cursor = 0;
  for (const [term, { docs, freqs }] of collected) {
    const start = cursor;
    for (let i = 0; i < docs.length; i++) {
      postingDocs[cursor] = docs[i];
      postingFreqs[cursor] = Math.min(freqs[i], 65535);
      cursor++;
    }
    slices.set(term, { start, end: cursor });
    df.set(term, docs.length);
  }

  return {
    clips,
    lens: Int32Array.from(lens),
    df,
    slices,
    postingDocs,
    postingFreqs,
    avgLen: clips.length ? totalLen / clips.length : 0,
  };
}

/* ------------------------- precomputed index on disk ---------------------- */

const INDEX_BIN = path.join(process.cwd(), 'data', 'search-index.bin');
const INDEX_VERSION = 1;

/**
 * Serialise the built index so a cold start does not have to tokenise 108k
 * documents.
 *
 * Building from scratch takes about 8 seconds, which is the whole cold-start
 * budget on a serverless platform. Reading typed arrays back off disk is a
 * memcpy. The layout is one buffer: a fixed header, then the numeric arrays,
 * then the term strings as a single newline-joined blob with parallel offset
 * and document-frequency tables.
 */
export function serialiseIndex(idx: Index): Buffer {
  const terms = [...idx.slices.keys()];
  const termBlob = Buffer.from(terms.join('\n'), 'utf8');

  /*
   * The indexed set is not the whole archive: build() skips clips with no
   * indexable terms, so doc ids do not line up with getAllClips() positions.
   * Storing those positions is what lets a precomputed index be reattached to
   * the archive exactly. Without it the clip-count check never matched and the
   * index was silently rebuilt on every boot — the file was written, read, and
   * then thrown away.
   */
  const all = getAllClips();
  const positionById = new Map(all.map((c, i) => [c.id, i]));
  const indexedPositions = Int32Array.from(idx.clips.map((c) => positionById.get(c.id) ?? -1));

  const header = Buffer.alloc(32);
  header.writeInt32LE(INDEX_VERSION, 0);
  header.writeInt32LE(all.length, 4); // archive size, for staleness
  header.writeInt32LE(terms.length, 8);
  header.writeInt32LE(idx.postingDocs.length, 12);
  header.writeDoubleLE(idx.avgLen, 16);
  header.writeInt32LE(termBlob.length, 24);
  header.writeInt32LE(idx.clips.length, 28); // indexed subset size

  const starts = new Int32Array(terms.length);
  const ends = new Int32Array(terms.length);
  const dfs = new Int32Array(terms.length);
  terms.forEach((t, i) => {
    const slice = idx.slices.get(t)!;
    starts[i] = slice.start;
    ends[i] = slice.end;
    dfs[i] = idx.df.get(t) ?? 0;
  });

  return Buffer.concat([
    header,
    Buffer.from(indexedPositions.buffer),
    Buffer.from(idx.lens.buffer, idx.lens.byteOffset, idx.lens.byteLength),
    Buffer.from(idx.postingDocs.buffer, idx.postingDocs.byteOffset, idx.postingDocs.byteLength),
    Buffer.from(idx.postingFreqs.buffer, idx.postingFreqs.byteOffset, idx.postingFreqs.byteLength),
    termBlob,
    Buffer.from(starts.buffer),
    Buffer.from(ends.buffer),
    Buffer.from(dfs.buffer),
  ]);
}

/** Read a precomputed index, or null if absent, stale or unreadable. */
function loadPrecomputed(clips: Clip[]): Index | null {
  if (!existsSync(INDEX_BIN)) return null;
  try {
    const buf = readFileSync(INDEX_BIN);
    if (buf.readInt32LE(0) !== INDEX_VERSION) return null;

    const archiveSize = buf.readInt32LE(4);
    // The archive changed under the index; rebuild rather than mismatch ids.
    if (archiveSize !== clips.length) return null;

    const numTerms = buf.readInt32LE(8);
    const numPostings = buf.readInt32LE(12);
    const avgLen = buf.readDoubleLE(16);
    const termBlobLen = buf.readInt32LE(24);
    const numDocs = buf.readInt32LE(28);

    let o = 32;
    const positions = new Int32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + numDocs * 4));
    o += numDocs * 4;
    const indexedClips = Array.from(positions, (p) => clips[p]);
    const lens = new Int32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + numDocs * 4));
    o += numDocs * 4;
    const postingDocs = new Int32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + numPostings * 4));
    o += numPostings * 4;
    const postingFreqs = new Uint16Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + numPostings * 2));
    o += numPostings * 2;
    const terms = buf.toString('utf8', o, o + termBlobLen).split('\n');
    o += termBlobLen;
    const starts = new Int32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + numTerms * 4));
    o += numTerms * 4;
    const ends = new Int32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + numTerms * 4));
    o += numTerms * 4;
    const dfs = new Int32Array(buf.buffer.slice(buf.byteOffset + o, buf.byteOffset + o + numTerms * 4));

    const slices = new Map<string, Slice>();
    const df = new Map<string, number>();
    for (let i = 0; i < numTerms; i++) {
      slices.set(terms[i], { start: starts[i], end: ends[i] });
      df.set(terms[i], dfs[i]);
    }

    return { clips: indexedClips, lens, df, slices, postingDocs, postingFreqs, avgLen };
  } catch {
    // A truncated or corrupt file must not take the server down; rebuild.
    return null;
  }
}

function getIndex(): Index {
  if (!index) index = loadPrecomputed(getAllClips()) ?? build();
  return index;
}

/** Force a full rebuild, for the script that writes the precomputed file. */
export function buildIndexFromScratch(): Index {
  return build();
}

/** Build the index eagerly so the first search doesn't pay for it. */
export function warmIndex(): void {
  getIndex();
}

/** How many documents contain a term. Diagnostic. */
export function termFrequency(term: string): number {
  return getIndex().df.get(term) ?? 0;
}

/** Total postings across all terms. Diagnostic. */
export function postingCount(): number {
  return getIndex().postingDocs.length;
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

  const { clips, lens, df, slices, postingDocs, postingFreqs, avgLen } = getIndex();

  /*
   * Repair words the index has never seen. "keralla", "mumbay" and "biriyani"
   * each returned nothing at all before this; a query that finds zero results
   * because of one slipped key is the worst outcome the search can produce.
   * Correctly spelled terms are left untouched — correction only ever fires on
   * a term with no postings.
   */
  const terms = raw.map((t) => correctSpelling(t) ?? t);
  const N = clips.length;

  // Require a majority of query terms so a two-word query isn't answered by
  // clips matching only its commonest word — the failure AUDIT.md §G recorded
  // for "Mumbai monsoon" and "Rajasthan village".
  const required = terms.length <= 2 ? terms.length : Math.ceil(terms.length * 0.6);

  /*
   * Walk each term's postings instead of every document. Scores and match
   * counts accumulate per document id; only documents that contain at least
   * one query term are ever touched, where the old forward index tested all
   * 108k for every term.
   */
  const scores = new Map<number, number>();
  const matches = new Map<number, number>();

  for (const term of terms) {
    const slice = slices.get(term);
    if (!slice) continue;

    const n = df.get(term) ?? 0;
    const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));

    for (let i = slice.start; i < slice.end; i++) {
      const docId = postingDocs[i];
      const f = postingFreqs[i];
      const contribution =
        idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (lens[docId] / avgLen))));

      scores.set(docId, (scores.get(docId) ?? 0) + contribution);
      matches.set(docId, (matches.get(docId) ?? 0) + 1);
    }
  }

  const hits: Hit[] = [];
  for (const [docId, score] of scores) {
    if (score > 0 && (matches.get(docId) ?? 0) >= required) {
      hits.push({ clip: clips[docId], score });
    }
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
  const { clips, df } = getIndex();
  const N = clips.length;
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

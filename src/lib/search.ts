import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { getAllClips, getPlace, getPlaces, indiaFirst } from './archive';
import { PLACE_ALIASES } from './interpret';
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

/*
 * Words that describe nothing you could point a camera at.
 *
 * The question words matter as much as the articles. "How do they make
 * jaggery" returned Pipistrelle bats and Himalayan butterflies, because `how`,
 * `do` and `they` counted as content: five terms meant three had to appear
 * together, and "How do they get rhythm and percussion so right?" satisfies
 * three of them while a clip titled "Making Jaggery Punjabi style" satisfies
 * one. Searching `jaggery` alone finds 96 clips.
 *
 * Words that could name something on screen are deliberately NOT here: `make`
 * and `making` (making jaggery, making doners), `can` (an oil can), `may` (the
 * month), `up`, `down`, `out`, `over` and `under`, which describe position.
 * `no` and `not` ARE here — there is no negation to honour, so "not tigers" is
 * best read as "tigers".
 */
const STOPWORDS = new Set([
  // articles, conjunctions, prepositions
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'from', 'by', 'as', 'about', 'into', 'if', 'but', 'so', 'such', 'than',
  'then', 'there', 'here',
  // copulas and auxiliaries
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'must',
  // pronouns and determiners
  'it', 'its', 'this', 'that', 'these', 'those', 'my', 'our', 'their', 'his',
  'her', 'i', 'we', 'you', 'they', 'them', 'he', 'she', 'him', 'us', 'me',
  // question words
  'how', 'what', 'when', 'where', 'why', 'who', 'whom', 'whose', 'which',
  // quantifiers and intensifiers that name nothing visible
  'all', 'any', 'each', 'some', 'more', 'most', 'other', 'only', 'just',
  'very', 'too', 'also', 'no', 'not',
]);

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Light suffix stripping. A full stemmer would mangle Indian place names.
 *
 * Order matters, and the previous three lines got two cases badly wrong by
 * stripping "es" from anything and "s" from everything else:
 *
 *   - "horses" became "hors" while "horse" stayed "horse", so the two never
 *     met. Measured overlap between the results for `horse` and `horses` was
 *     11%; for `house`/`houses`, 4%.
 *   - "glass" became "glas" while "glasses" became "glass" — the singular was
 *     stemmed further than the plural. `glass`/`glasses` overlapped 2%,
 *     `dress`/`dresses` 1%.
 *
 * The rules below are Porter's step 1a, minus the parts that need a syllable
 * measure. "-ss" is now protected, "-sses" and the epenthetic "-xes/-ches/
 * -shes" lose the whole "es", and everything else loses only the "s".
 */
/**
 * Plurals no suffix rule can reach.
 *
 * Kept deliberately short and corpus-specific. "men"/"man", "women"/"woman" and
 * "children"/"child" overlapped 3%, 7% and 6% — three of the commonest words in
 * a documentary archive about people. "buses" is here because the -es rule
 * above correctly turns "horses" into "horse" and therefore turns "buses" into
 * "buse"; naming the exception is cheaper than a syllable measure.
 *
 * Verbs that look like plurals are excluded on purpose: "lives" and "saves" are
 * far more often verbs here than plurals of "life" and "safe".
 */
const IRREGULAR_PLURALS: Record<string, string> = {
  men: 'man',
  women: 'woman',
  children: 'child',
  buses: 'bus',
  leaves: 'leaf',
  calves: 'calf',
  wolves: 'wolf',
  mice: 'mouse',
  geese: 'goose',
  feet: 'foot',
  teeth: 'tooth',
};

function stem(token: string): string {
  const irregular = IRREGULAR_PLURALS[token];
  if (irregular) return irregular;

  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  // glasses -> glass, dresses -> dress
  if (token.length > 4 && token.endsWith('sses')) return token.slice(0, -2);
  // glass, dress, grass: already singular, and stripping the s split them from
  // their own plurals.
  if (token.endsWith('ss')) return token;
  // boxes -> box, churches -> church, dishes -> dish. The "e" is inserted for
  // pronunciation here, so it belongs to the suffix.
  if (token.length > 4 && /(?:x|z|ch|sh)es$/.test(token)) return token.slice(0, -2);
  // horses -> horse, houses -> house, birds -> bird
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
/*
 * Bump whenever tokenise() or stem() changes.
 *
 * The terms on disk were produced by the tokeniser of the day, so a stemmer fix
 * with the version left alone would load a stale index and silently do nothing
 * — the code would be correct and the behaviour unchanged. 2: the -ss / -es
 * stemming fix. 3: the irregular-plural table. 4: question words added to
 * STOPWORDS.
 */
const INDEX_VERSION = 4;

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

/* ---------------------------- talking-head demotion ----------------------- */

/**
 * Someone talking ABOUT a thing is not footage OF that thing.
 *
 * Searching "bird" returned, at number one, "Malika Arora talks on Macao bird
 * 'This is not an ordinary bird...'" — a celebrity interview, ranked above
 * 4,538 clips of actual birds, because the word appears twice in the title and
 * titles count triple. The clip is even tagged `wildlife, birds`, so no amount
 * of subject filtering would have caught it; the tagger read the word too.
 *
 * The fix is not a Bollywood blocklist. The archive's value is footage, and
 * this is the general form of the problem: a press meet, an interview, a farmer
 * describing his crop and an actress discussing a film are all people speaking
 * to camera, and none of them is what someone typing a plain noun wants to see.
 * 1,136 clips, 1.05% of the archive.
 *
 * A MULTIPLIER, not a filter, and this is the important part: searching the
 * person's name still finds them. A name is rare, so its IDF is enormous and
 * nothing else competes — the penalty cannot push the only clip about someone
 * below clips that do not mention them at all. It only decides who wins when a
 * talking head and real footage are both plausible answers to the same word.
 */
const TALKING_HEAD_PENALTY = 0.3;

/*
 * Deliberately conservative. Each pattern needs a person doing the speaking:
 * bare "reveals" was tried and matched "Time lapse reveals a California Poppy
 * blooming into a fully open flower", which is exactly the footage this is
 * supposed to protect.
 */
const TALKING_HEAD = [
  /\b(?:talks?|talking|speaks?|speaking)\s+(?:on|about|to)\b/i,
  /\binterviews?\b/i,
  /\bin conversation with\b/i,
  /\bopens up (?:on|about)\b/i,
  /\b(?:recalls|reacts to|responds to)\b/i,
  /\bpress (?:conference|meet)\b/i,
  /\bon (?:his|her|their) (?:new |upcoming )?(?:film|movie|song|album|role|character|career)\b/i,
  /\bshares (?:his|her|their)\b/i,

  /*
   * Film-industry coverage. Narrow on purpose: an earlier attempt keyed on
   * "film", "award", "song" and "cinema" and swept up the Republic Day parade's
   * National Child Award winners, a Mizo folk song at Chapchar Kut, and traffic
   * at Savitri *cinema* flyover. These words have no second meaning.
   */
  /\bbollywood\b/i,
  /\bitem (?:song|number)\b/i,
  /\bco-?stars?\b/i,
  /\bstarrer\b/i,
  /\b(?:film|movie|music|trailer|audio) (?:launch|promotion|premiere|release event)\b/i,
  /\b(?:filmfare|iifa|stardust|screen awards|zee cine)\b/i,
  /*
   * "Emraan Hashmi: Film Jannat, is based on cricket, but I don't watch
   * cricket" ranked second for "cricket". Two capitalised words, a colon and a
   * film word is a quoted celebrity statement; the film word is what keeps it
   * off "Chandni Chowk: busy market morning".
   *
   * The name half must stay case-SENSITIVE, so the film half spells both cases
   * rather than taking an /i flag. Written with \b...\b and an /i flag first,
   * it silently never matched "Film Jannat" — the capital F.
   */
  /^[A-Z][a-z]+ [A-Z][a-z]+:.*\b(?:[Ff]ilm|[Mm]ovie|[Rr]ole|[Ss]ong|[Aa]lbum)\b/,

  // "Kim Sharma actress & John Abraham on cricket" — the job title is the tell,
  // and unlike "actor" it has no everyday second sense.
  /\bactress\b/i,

  /*
   * Single-name quotes. The two-word rule above needs a surname and so missed
   * "Shaan: Film is important not star cast", "Pritam: Abbas Mustan makes me
   * comfortable", "Mammootty: We make films…" — 6 clips, every one a quoted
   * statement about films.
   */
  /^[A-Z][a-z]+:\s.*\b(?:[Ff]ilm|[Mm]ovie|[Rr]ole|[Ss]ong|[Aa]lbum|[Ss]tar)\b/,

  /*
   * Calendar launches: 7 clips, all red-carpet. "Launch" on its own is far too
   * broad — rockets, ships and products all launch — so the noun is named.
   */
  /\bcalendar launch\b/i,

  /*
   * A name, a colon, and someone speaking in the first person. 304 clips, and
   * the most general form of the whole class: "Sushmita Sen: I'm an actor",
   * "Karan Sharma: My first shoot was a dance sequence". It needs no film
   * vocabulary, which is what the narrower rules above kept depending on. A
   * non-celebrity caught by it — "Farmer: I lost my crop" — is a talking head
   * too, and belongs below the footage for the same reason.
   */
  /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?:\s*['"]?\s*(?:I|My|Me|We|Our)\b/,
];

export function isTalkingHead(clip: Clip): boolean {
  return TALKING_HEAD.some((re) => re.test(clip.title));
}

/**
 * Is the person ASKING for people talking?
 *
 * Demoting unconditionally made "press conference" rank a protest to "press for
 * rollback of constitutional amendments" above actual press conferences, which
 * is the penalty firing against the one query it should never touch. When the
 * query itself names the format, the format is the subject and the penalty is
 * switched off.
 */
const WANTS_TALKING_HEAD =
  /\b(?:interviews?|press\s+(?:conference|meet)|talks?\s+(?:on|about)|speaks?\s+(?:on|about)|in conversation|opens up|bollywood|actor|actress|celebrity|film\s+star|item\s+(?:song|number)|filmfare|iifa|red\s+carpet|premiere)\b/i;

/**
 * How rare a query term has to be before it counts as naming something.
 *
 * This is the "unless you mention their name" half of the rule, and it is
 * measured rather than guessed. Across the archive, plain nouns sit low —
 * festival 0.40, bird 0.61, dance 0.61, temple 0.61, monsoon 0.81, elephant
 * 0.92 — while names and specifics sit high: malaika 1.60, emraan 1.60, rupin
 * 1.50, arora 1.50, avalanche 1.58, compassion 1.47, asiatic 1.31. The gap is
 * wide and the boundary sits in it.
 *
 * A flat penalty was tried first and was wrong. The reasoning behind it — "a
 * name is rare, so nothing competes with it" — only holds for names appearing
 * ONCE. For anyone the archive covers repeatedly it failed badly: "Rupin Dang
 * rhododendron" put the man himself at rank 79 of 95, "Asiatic lions Gujarat"
 * at 111 of 113, and "Dalai Lama compassion" past rank 500. Naming somebody has
 * to switch the penalty off, not merely survive it.
 */
const SPECIFIC_QUERY_RARITY = 1.15;

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
 * Words that are never typos, however rarely this archive uses them.
 *
 * The frequency guard cannot tell a misspelling from a correct word the
 * archive simply does not cover. "Paris" appears fewer than four times, so it
 * was eligible for repair, and "pari" — Pari Tibba, a hill above Mussoorie —
 * is one edit away and far commoner. Answering "Paris" therefore returned Pari
 * Tibba sunsets and Plaster of Paris. Turning one real proper noun into a
 * different real proper noun is worse than honestly finding nothing.
 *
 * Built from the gazetteer's place names and the closed subject vocabulary, so
 * anything the system already knows as a name is left exactly as typed.
 */
let protectedTerms: Set<string> | null = null;

function isProtectedTerm(term: string): boolean {
  if (!protectedTerms) {
    const set = new Set<string>();
    for (const place of getPlaces()) {
      // Split so "New Delhi" protects "delhi" and "Jammu and Kashmir"
      // protects "kashmir".
      for (const word of place.name.toLowerCase().split(/[^a-z0-9]+/)) {
        if (word.length >= 4) set.add(word);
      }
    }
    for (const subject of SUBJECTS) {
      for (const word of subject.toLowerCase().split(/[^a-z0-9]+/)) {
        if (word.length >= 4) set.add(word);
      }
    }
    protectedTerms = set;
  }
  return protectedTerms.has(term);
}

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

  /*
   * "Known" is tested against the STEMMED form as well as the literal one.
   *
   * The index is keyed by stems, so a word whose stem differs from itself has
   * no entry under its own spelling and looks unknown however common it is.
   * "Iris" is stored as "iri", so `df.get('iris')` was 0, and the repair turned
   * the flower into "Irish" — one edit away and far commoner. Callers that pass
   * raw words (the feed's title-evidence check) then looked for "irish" in the
   * titles and threw away all five Iris clips.
   *
   * Any singular ending in -s is exposed to this: iris, gas, lens, campus,
   * virus, atlas.
   */
  const known = Math.max(df.get(term) ?? 0, df.get(stem(term)) ?? 0);
  if (term.length < 4 || known > TYPO_MAX_DF) return null;
  if (isProtectedTerm(term)) return null;

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

/**
 * Words for the same thing, so a query finds both.
 *
 * The place half is shared with interpret.ts rather than copied: resolving
 * "Bombay" to Mumbai for the feed while `/search?q=Bombay` returned only the
 * 955 clips spelling it the old way — out of 3,089 — was one fact applied in
 * one place and not the other. Measured overlap before this: Mumbai/Bombay 15%,
 * Kolkata/Calcutta 18%, Chennai/Madras 14%, Prayagraj/Allahabad 4%.
 *
 * The rest are transliteration variants of a single word. Every pair was
 * counted in the corpus first — a synonym for something the archive does not
 * hold is a rule that can only do harm. "Riksha" was dropped for having one
 * clip against 936 for "rickshaw".
 */
const WORD_SYNONYMS: Record<string, string> = {
  pooja: 'puja',
  deepavali: 'diwali',
  ganesha: 'ganesh',
  gurdwara: 'gurudwara',
  masjid: 'mosque',
  mandir: 'temple',
  saree: 'sari',
  allahabad: 'prayagraj',
};

let synonymGroups: Map<string, string[]> | null = null;

/** Every indexed spelling of the thing this term names, itself included. */
function variantsFor(stemmed: string): string[] {
  if (!synonymGroups) {
    // canonical -> every spelling that means it, all stemmed, because the
    // index is keyed by stems: "Benares" is stored as "benare".
    const byCanonical = new Map<string, Set<string>>();
    const add = (alias: string, canonical: string) => {
      const key = stem(canonical);
      const set = byCanonical.get(key) ?? new Set([key]);
      set.add(stem(alias));
      byCanonical.set(key, set);
    };
    for (const [alias, canonical] of Object.entries(PLACE_ALIASES)) add(alias, canonical);
    for (const [alias, canonical] of Object.entries(WORD_SYNONYMS)) add(alias, canonical);

    const groups = new Map<string, string[]>();
    for (const set of byCanonical.values()) {
      const members = [...set];
      for (const member of members) groups.set(member, members);
    }
    synonymGroups = groups;
  }
  return synonymGroups.get(stemmed) ?? [stemmed];
}

/**
 * Reward titles that keep the query's words TOGETHER.
 *
 * BM25 is a bag of words: it cannot tell "Republic Day" the name from "Day" and
 * "1997" sitting in different halves of a sentence. Searching "Republic Day
 * 1997" returned "Rishang Keishing at observance of Nupilal Day in Manipur -
 * 1997" first, because the archive holds no Republic Day 1997 footage, both
 * clips satisfy two of the three words, and "1997" is rarer than "republic" so
 * it won the tie. Most multi-word answers in this archive are names — Republic
 * Day, Kumbh Mela, Dal Lake, Chandni Chowk — and adjacency is what makes them
 * names.
 *
 * Substring matching on the title rather than true positional postings: the
 * index stores frequencies, not offsets, and adding positions would grow it for
 * a signal only needed to break ties among the already-relevant. Applied to the
 * top of the ranking only, for the same reason — a clip far down on BM25 will
 * not reach the first page on a 35% nudge, so there is nothing to gain by
 * scoring the tail.
 */
const PHRASE_BONUS = 0.35;
const PHRASE_WINDOW = 400;

function promotePhrases(query: string, hits: Hit[]): Hit[] {
  // Stopwords are kept: they are in the titles too, and "Rann of Kutch" is only
  // a phrase with its "of".
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length < 2 || hits.length < 2) return hits;

  const bigrams: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) bigrams.push(`${words[i]} ${words[i + 1]}`);

  const window = hits.slice(0, PHRASE_WINDOW);
  const rest = hits.slice(PHRASE_WINDOW);

  const boosted = window.map((hit) => {
    const title = hit.clip.title.toLowerCase();
    let adjacent = 0;
    for (const pair of bigrams) if (title.includes(pair)) adjacent++;
    return adjacent ? { ...hit, score: hit.score * (1 + PHRASE_BONUS * adjacent) } : hit;
  });

  boosted.sort((a, b) => b.score - a.score);
  return boosted.concat(rest);
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
    /*
     * One query word, every spelling of it. Counted as ONE satisfied term
     * however many variants a clip happens to contain, or a title saying both
     * "Mumbai" and "Bombay" would out-vote the majority rule on its own.
     */
    const matchedHere = new Set<number>();

    for (const variant of variantsFor(term)) {
      const slice = slices.get(variant);
      if (!slice) continue;

      const n = df.get(variant) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));

      for (let i = slice.start; i < slice.end; i++) {
        const docId = postingDocs[i];
        const f = postingFreqs[i];
        const contribution =
          idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (lens[docId] / avgLen))));

        scores.set(docId, (scores.get(docId) ?? 0) + contribution);
        matchedHere.add(docId);
      }
    }

    for (const docId of matchedHere) matches.set(docId, (matches.get(docId) ?? 0) + 1);
  }

  /*
   * Only a broad query is protected from talking heads. Naming a person, or
   * anything else the archive rarely mentions, means the person IS the subject
   * — so the penalty would be fighting the query it was built to serve.
   */
  const namesSomething = terms.some((t) => termRarity(t) >= SPECIFIC_QUERY_RARITY);
  const demote = !namesSomething && !WANTS_TALKING_HEAD.test(query);

  const collect = (need: number): Hit[] => {
    const out: Hit[] = [];
    for (const [docId, score] of scores) {
      if (score > 0 && (matches.get(docId) ?? 0) >= need) {
        const clip = clips[docId];
        out.push({
          clip,
          score: demote && isTalkingHead(clip) ? score * TALKING_HEAD_PENALTY : score,
        });
      }
    }
    return out;
  };

  /*
   * Relax the conjunction rather than answer with nothing.
   *
   * The majority rule stops a two-word query being answered by clips matching
   * only its commonest word, but applied rigidly it falls off a cliff: "kolkata
   * tram" found 58 clips, and "kolkata tram monsoon railway" found ONE, because
   * three of those four words now had to appear together. Adding detail to a
   * search should not empty it.
   *
   * Costs nothing extra. The postings have already been walked and the per-
   * document match counts are in hand, so lowering the bar is a re-filter of a
   * map that is already built — no second pass over the index.
   */
  const RELAX_FLOOR = 8;
  let hits = collect(required);
  for (let need = required - 1; hits.length < RELAX_FLOOR && need >= 1; need--) {
    const relaxed = collect(need);
    if (relaxed.length > hits.length) hits = relaxed;
  }

  hits.sort((a, b) => b.score - a.score);
  hits = promotePhrases(query, hits);

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
   * carried a Goa tag.
   *
   * Shared TAGS alone were not enough either. For a placed clip the pool is
   * everything from that place — 13,886 clips for Delhi — so "Holi festival of
   * colours" offered Jagannath Rath Yatra and a Kushti wrestling competition,
   * all three being Delhi clips tagged `festival`. Tags say what kind of thing
   * it is; the title says which one.
   *
   * So the words lead and the tags break ties, weighted by rarity: sharing
   * "holi" with the clip being watched means far more than sharing "festival"
   * or "India". Substring matching on the raw title keeps this cheap enough to
   * run over a whole city's footage on every watch page.
   */
  const wanted = new Set(clip.subjects);

  /*
   * Raw words and substring tests, NOT tokenise() per candidate. Tokenising
   * every title in the pool allocated an array and a Set for each of Delhi's
   * 13,886 clips and took 579ms on one watch page; this is the same comparison
   * for a few milliseconds. Rarity is still looked up on the stem, because that
   * is how the index is keyed.
   */
  const seedWords = [
    ...new Set(
      clip.title
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  ];
  const weights = new Map(seedWords.map((w) => [w, termRarity(stem(w))]));

  return pool
    .map((c) => {
      const title = c.title.toLowerCase();
      let words = 0;
      for (const w of seedWords) if (title.includes(w)) words += weights.get(w) ?? 0;
      const shared = c.subjects.reduce((n, s) => n + (wanted.has(s) ? 1 : 0), 0);
      // Tags are worth a fraction of a distinctive shared word, so they order
      // clips that share no vocabulary rather than overriding those that do.
      return { clip: c, score: words + shared * 0.25 };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
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

  /*
   * Talking heads sink; then the longer title wins.
   *
   * Ordering on title length alone is a rough "better documented" proxy, and
   * interview titles are long — they carry a name and a quote — so Mumbai's
   * place page ran a marathon and then "Dusky Priyanka Chopra dances, sips
   * champagne at a Mumbai calendar launch" second. Search already knows this
   * class; the place page was the one surface not asking.
   */
  const all = getAllClips()
    .filter((c) => c.placeId === placeId)
    .sort(
      (a, b) =>
        Number(isTalkingHead(a)) - Number(isTalkingHead(b)) ||
        b.title.length - a.title.length,
    );

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

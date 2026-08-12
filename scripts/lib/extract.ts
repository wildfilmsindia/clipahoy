/**
 * Extraction from YouTube metadata.
 *
 * WildFilmsIndia descriptions have a consistent three-zone shape, confirmed
 * against a 200-video sample (zero empty, median 2,402 characters):
 *
 *   1. PROSE     — a written paragraph describing what is actually on screen.
 *                  High signal. This is the only zone a human wrote about
 *                  this specific clip.
 *   2. HASHTAGS  — "#khichan #rajasthan #kurja #migratorybirds". Very high
 *                  signal for place, good for subject, and already normalised.
 *   3. SEO TAIL  — a comma-separated keyword dump. Deliberate keyword
 *                  stuffing. Mentions everything, means nothing.
 *
 * Treating the description as one blob is worse than using the title alone,
 * because the SEO tail matches most of the subject vocabulary on every video.
 * So each zone is scored separately and the tail is ignored for subjects.
 */

import { SUBJECTS, type Subject } from '../../src/lib/types';

export type Zones = {
  prose: string;
  hashtags: string[];
  tail: string;
};

/** Split a description into its three zones. */
export function splitZones(description: string): Zones {
  const lines = description.split('\n');

  const proseLines: string[] = [];
  const hashtags: string[] = [];
  const tailLines: string[] = [];

  // Once we have seen the hashtag block, everything after it is the SEO tail.
  let seenHashtags = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tags = trimmed.match(/#[\p{L}\p{N}_]+/gu);
    // A line is "the hashtag block" if hashtags are most of what's on it.
    if (tags && tags.join('').length > trimmed.length * 0.5) {
      hashtags.push(...tags.map((t) => t.slice(1).toLowerCase()));
      seenHashtags = true;
      continue;
    }

    if (seenHashtags) tailLines.push(trimmed);
    else proseLines.push(trimmed);
  }

  return { prose: proseLines.join(' '), hashtags, tail: tailLines.join(' ') };
}

/* --------------------------------- places -------------------------------- */

export type GazetteerEntry = {
  district: string;
  state: string;
  country?: string;
  region: string;
  terrain: string;
  lat: number;
  lng: number;
  /** 'city' beats 'state' when both appear — prefer the more specific place. */
  kind: 'city' | 'state';
};

export type PlaceHit = {
  placeId: string;
  /** Where the name was found. Drives confidence. */
  source: 'playlist' | 'hashtag' | 'title' | 'prose';
  kind: 'city' | 'state';
  /**
   * True when the name is preceded by a locative preposition — "in Delhi",
   * "at Kaziranga", "near Meerut". This is the strongest available signal that
   * a place is where the camera was, rather than a place merely named.
   */
  locative?: boolean;
  /**
   * True when preceded by an origin marker — "from Tibet", "breed of Tibet",
   * "native to". These mark provenance, which is precisely NOT the venue.
   */
  origin?: boolean;
};

/**
 * Find the best place for a video.
 *
 * Preference order is specificity first, then trust:
 *   a city in the hashtags  >  a city in the title  >  a city in the prose
 *   >  a state in the hashtags  >  a state in the title  >  a state in the prose
 *
 * The SEO tail is never consulted — it name-drops states for reach, not
 * because the footage was shot there.
 */
/**
 * How much of the prose zone may be scanned for a place name.
 *
 * Audited on a 100-clip hand sample: scanning the full prose gave 57.1%
 * precision in that zone and dragged the whole cascade to 78.0%, below the
 * 80% bar. The failure mode is not noise but *drift* — descriptions open by
 * stating what the clip shows, then wander into background: the river's
 * course through other states, where the interviewee took their degree, which
 * region a dance form originates from. All of those read as locations and
 * none of them is where the camera was.
 *
 * Truncating to the first two sentences lifted prose-inclusive precision to
 * 88.0% while costing only 9 of 100 records their location, versus 23 lost by
 * forbidding prose from originating a location at all. Measured, not guessed:
 * see scripts/audit/step3-fixtest.ts.
 */
const PROSE_SENTENCE_LIMIT = 2;

function firstSentences(prose: string, n: number): string {
  return prose.split(/(?<=[.!?])\s+/).slice(0, n).join(' ');
}

export function extractPlace(
  title: string,
  zones: Zones,
  gazetteer: Record<string, GazetteerEntry>,
  aliases: Record<string, string>,
  playlistTitle?: string,
): PlaceHit | null {
  const resolve = (token: string): string | null => {
    const key = token.toLowerCase().trim();
    if (aliases[key]) return aliases[key];
    if (gazetteer[key]) return key;
    return null;
  };

  const hits: PlaceHit[] = [];

  // Hashtags are already tokenised, so match them whole rather than by regex.
  for (const tag of zones.hashtags) {
    const id = resolve(tag);
    if (id) hits.push({ placeId: id, source: 'hashtag', kind: gazetteer[id].kind });
  }

  const scan = (text: string, source: 'playlist' | 'title' | 'prose') => {
    const haystack = text.toLowerCase();
    for (const [name, canonical] of [
      ...Object.entries(aliases),
      ...Object.keys(gazetteer).map((k) => [k, k] as [string, string]),
    ]) {
      // Word-boundary match so "Goa" doesn't fire inside "Goalpara".
      const re = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
      const m = re.exec(haystack);
      if (!m) continue;
      const entry = gazetteer[canonical];
      if (!entry) continue;

      // Look backwards from the match for the preceding word, skipping any
      // punctuation. Matching this in the pattern itself silently dropped
      // every name preceded by a comma ("houseboats, Srinagar") and cost
      // ~1,100 clips their location.
      const before = haystack
        .slice(Math.max(0, m.index - 24), m.index)
        .replace(/[^a-z\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .pop() ?? '';

      hits.push({
        placeId: canonical,
        source,
        kind: entry.kind,
        locative: LOCATIVE.has(before),
        origin: ORIGIN.has(before),
      });
    }
  };


  if (playlistTitle) scan(playlistTitle, 'playlist');
  scan(title, 'title');
  scan(firstSentences(zones.prose, PROSE_SENTENCE_LIMIT), 'prose');

  if (hits.length === 0) return null;

  const kindRank = { city: 0, state: 1 };
  const sourceRank = { playlist: 0, hashtag: 1, title: 2, prose: 3 };

  /*
   * Locative beats everything.
   *
   * Measured on a 100-clip hand audit (seed 307): 6-8% of clips with a place
   * had the WRONG one because a place was named without being the venue — a
   * team in "Pakistan v/s India", an organisation's name ("Tibetan Institute
   * of Performing Arts", filmed in New Delhi), a destination ("road trip to
   * Kathmandu"), a breed's provenance ("Pashmina goat, a breed from Tibet",
   * filmed in Ladakh). In every case the true venue WAS present and marked by
   * a locative preposition, and the false one was not.
   *
   * So grammar outranks both specificity and source trust: "in New Delhi" in
   * the prose beats "Tibet" in a curated playlist title. An explicit origin
   * marker sorts last, below even a bare mention.
   */
  const positional = (h: PlaceHit) => (h.locative ? 0 : h.origin ? 2 : 1);

  hits.sort(
    (a, b) =>
      positional(a) - positional(b) ||
      kindRank[a.kind] - kindRank[b.kind] ||
      sourceRank[a.source] - sourceRank[b.source],
  );

  return hits[0];
}

/** Prepositions that mark where something IS. */
const LOCATIVE = new Set([
  'in', 'at', 'near', 'outside', 'inside', 'around', 'across', 'along',
  'through', 'over', 'above', 'below', 'beside', 'towards', 'toward',
  'within', 'throughout',
]);

/** Markers of provenance — where something came FROM, not where it is. */
const ORIGIN = new Set(['from', 'of', 'native', 'origin', 'originates', 'belongs']);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------- subjects ------------------------------- */

const SUBJECT_KEYWORDS: Record<Subject, string[]> = {
  railway: ['railway', 'railways', 'train', 'locomotive', 'platform', 'junction', 'rail'],
  bazaar: ['bazaar', 'bazar', 'market', 'mandi', 'haat', 'stalls', 'vendors'],
  river: ['river', 'canal', 'backwater', 'stream', 'ghat', 'lake', 'waterfall'],
  school: ['school', 'schoolchildren', 'classroom', 'students', 'pupils'],
  temple: ['temple', 'shrine', 'mosque', 'church', 'gurudwara', 'pilgrim'],
  monsoon: ['monsoon', 'rain', 'rainfall', 'downpour', 'flood', 'flooded', 'drizzle'],
  farmland: ['farm', 'farmland', 'field', 'fields', 'paddy', 'crop', 'harvest', 'plough', 'orchard'],
  'street food': ['street food', 'snack', 'chai', 'tea stall', 'kachori', 'samosa', 'cooking'],
  bus: ['bus', 'buses', 'bus stand', 'depot'],
  coastline: ['coast', 'beach', 'sea', 'shore', 'harbour', 'harbor', 'fishing boat'],
  hills: ['hill', 'hills', 'mountain', 'valley', 'slope', 'ridge', 'himalaya', 'himalayan'],
  festival: ['festival', 'procession', 'mela', 'yatra', 'fair', 'celebration'],
  wildlife: ['wildlife', 'bird', 'birds', 'tiger', 'elephant', 'monkey', 'leopard', 'deer', 'crane'],
  'old town': ['old town', 'old city', 'lanes', 'alley', 'walled city', 'quarter', 'heritage'],
  highway: ['highway', 'road', 'traffic', 'truck', 'expressway', 'flyover'],
  dance: ['dance', 'dancing', 'dancers', 'dancer', 'nritya', 'natyam', 'kathak', 'bharatanatyam', 'odissi', 'kuchipudi', 'bhangra', 'garba', 'folk dance'],
  music: ['music', 'musician', 'singer', 'sings', 'singing', 'song', 'concert', 'orchestra', 'band', 'sitar', 'tabla', 'flute', 'drum', 'drumming', 'qawwali', 'ghazal', 'bhajan', 'kirtan'],
  ceremony: ['ceremony', 'ritual', 'rituals', 'puja', 'prayer', 'prayers', 'aarti', 'worship', 'wedding', 'marriage', 'funeral', 'cremation', 'blessing', 'offering'],
  village: ['village', 'villagers', 'rural', 'hamlet', 'countryside', 'gaon'],
  flowers: ['flower', 'flowers', 'blossom', 'bloom', 'blooming', 'garden', 'orchid', 'rhododendron', 'tulip', 'lily', 'rose', 'poppy', 'botanical'],
  forest: ['forest', 'forests', 'woodland', 'jungle', 'canopy', 'deodar', 'pine', 'oak', 'sanctuary', 'reserve'],
  fort: ['fort', 'fortress', 'citadel', 'ramparts', 'stepwell', 'baoli', 'mausoleum'],
  aerial: ['aerial', 'aerials', 'drone', 'from the air', "bird's eye", 'seen aerially', 'flying over', 'overhead view'],
  crafts: ['handicraft', 'handicrafts', 'craft', 'crafts', 'weaving', 'weaver', 'pottery', 'potter', 'artisan', 'handloom', 'embroidery', 'carving', 'silverware', 'jewellery'],
  industry: ['factory', 'industrial', 'manufacturing', 'workshop', 'labour', 'labourers', 'workers', 'mining', 'mill', 'plant', 'machinery', 'construction'],
  sport: ['cricket', 'football', 'hockey', 'kabaddi', 'wrestling', 'athletics', 'tournament', 'match', 'sport', 'sports', 'olympics', 'marathon', 'race'],
  politics: ['election', 'elections', 'rally', 'parliament', 'minister', 'political', 'protest', 'campaign', 'voting', 'government', 'assembly'],
  snow: ['snow', 'snowfall', 'snowy', 'glacier', 'ice', 'frozen', 'blizzard', 'avalanche', 'winter freeze'],
  birds: ['bird', 'birds', 'barbet', 'kingfisher', 'thrush', 'bulbul', 'parakeet', 'woodpecker', 'eagle', 'owl', 'crane', 'heron', 'egret', 'myna', 'drongo', 'sunbird', 'flycatcher', 'babbler'],
  livestock: ['cattle', 'buffalo', 'buffaloes', 'cow', 'cows', 'goat', 'goats', 'sheep', 'camel', 'camels', 'livestock', 'poultry', 'dairy', 'herd'],
  architecture: ['building', 'buildings', 'architecture', 'mosque', 'church', 'gurudwara', 'tower', 'bridge', 'skyline', 'apartment'],
  boats: ['boat', 'boats', 'ferry', 'houseboat', 'rowing', 'canoe', 'shikara', 'sailing'],
  desert: ['desert', 'dunes', 'sand dunes', 'arid', 'thar'],
  lake: ['lake', 'lakes', 'reservoir', 'pond', 'wetland', 'tso'],
};

/**
 * Score subjects across zones instead of taking the first four matches.
 *
 * Prose is what the clip is; hashtags are what the uploader says it is; the
 * title is a headline. A subject has to clear a threshold to be tagged, so a
 * single passing mention of "road" does not make a clip a highway clip.
 */
export function extractSubjects(title: string, zones: Zones): Subject[] {
  const scored: { subject: Subject; score: number }[] = [];

  for (const subject of SUBJECTS) {
    const kws = SUBJECT_KEYWORDS[subject];
    let score = 0;

    for (const kw of kws) {
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'gi');
      const inProse = (zones.prose.match(re) ?? []).length;
      const inTitle = (title.match(re) ?? []).length;
      const inTags = zones.hashtags.filter((t) => t.includes(kw.replace(/\s+/g, ''))).length;

      score += inTitle * 3 + inTags * 3 + Math.min(inProse, 3) * 2;
    }

    if (score > 0) scored.push({ subject, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Require real evidence, and never tag more than three — a clip that is
  // "about" five things is about nothing, and the diversity penalty in
  // retrieval depends on subjects being meaningful.
  return scored.filter((s) => s.score >= 4).slice(0, 3).map((s) => s.subject);
}

/* ---------------------------------- year --------------------------------- */

/**
 * Archive footage is usually published decades after it was shot, so the
 * upload date is not the year. Only trust an explicit year in the prose or
 * title; otherwise leave it null and let the UI say nothing.
 */
export function extractYear(title: string, zones: Zones): number | null {
  const match = `${title} ${zones.prose}`.match(/\b(19[3-9]\d|20[0-2]\d)\b/);
  return match ? Number(match[1]) : null;
}

/* -------------------------------- rejection ------------------------------ */

/**
 * Content that is not footage of a place, and never will be.
 *
 * A meaningful slice of this channel is entertainment press — Lakme Fashion
 * Week, film promotion events, celebrity soundbites. That is the exact
 * opposite of the register this product is for, so it is excluded rather than
 * merely left unmatched, which keeps "not eligible" distinct from "we failed
 * to place it" in the ingest report.
 *
 * These patterns were tuned against the real corpus. Earlier, broader
 * versions matched bare "fashion show" and "ramp walk", which threw out
 * legitimate footage — a Mizo winter festival, tribal dress in Shillong.
 * Anything here must be a *commercial* entertainment marker, not a garment.
 */
const NOT_PLACE_FOOTAGE: [name: string, test: RegExp][] = [
  /*
   * Only genuinely contentless records are excluded.
   *
   * An earlier revision filtered the entertainment industry out entirely —
   * Bollywood, celebrity soundbites, premieres, fashion shows, production
   * houses, ~190 performer names. That is reverted by request: this footage is
   * part of the archive and is now searchable like everything else.
   *
   * What remains are YouTube placeholders for videos that no longer exist.
   * They carry no title, no description and no footage, so there is nothing to
   * index or describe.
   */
  ['unavailable video', /^\s*(?:private|deleted) video\s*$/i],
];

export function isRejected(title: string, zones: Zones): string | null {
  // Title only. The prose often mentions a film or an actor in passing, and
  // matching on it rejected footage that was simply described in context.
  void zones;
  for (const [name, test] of NOT_PLACE_FOOTAGE) {
    if (test.test(title)) return name;
  }
  return null;
}

import 'server-only';

import { getAllClips, getClipsForPlace, getPlace, isIndian } from './archive';
import { search, termRarity } from './search';
import { interpret, isEmpty, type Signals } from './interpret';
import type { Answers } from './taste';
import type { Clip, Subject } from './types';

/**
 * Ranks the archive against what a person typed.
 *
 * Scoring is structural first — place, state, region, terrain, subject — which
 * is one pass over the clip array with no string work, so it stays cheap
 * across 73k records. Free text is folded in through the existing BM25 index
 * rather than by re-scanning descriptions.
 *
 * There is no popularity, watch-count or recency input anywhere here, because
 * the archive has none. Everything is derived from metadata that exists.
 */

/*
 * Weights.
 *
 * `text` now outranks `place`. It used to be the other way round (place 10,
 * text 7), which meant naming a city drowned everything else: "Kolkata" plus
 * "Ganesh Chaturthi" returned generic Kolkata streets with no Ganesh in them,
 * because any Kolkata clip scored 10 and the best Ganesh match scored 7. With
 * two of the five questions asking about festivals and streets, that made
 * those answers close to invisible whenever a place was also given.
 *
 * A clip matching both still wins outright (7 + 9), which is the ordering we
 * actually want. Place-only answers are unaffected: when place is the sole
 * signal its absolute value cannot change the ranking, only its presence.
 */
const W = {
  place: 7,
  state: 5,
  region: 2,
  terrain: 3,
  subject: 4,
  /** Scaled by BM25 rank AND term rarity, so a common word cannot dominate. */
  text: 9,
} as const;

/** Subjects that read as memory rather than as news. */
const NOSTALGIC: Subject[] = ['old town', 'railway', 'bazaar', 'architecture', 'fort', 'bus'];

/**
 * Per-clip relevance boost for the free-text signals, scaled by how specific
 * each term is.
 *
 * Without the rarity scale every typed word competed equally, so a word the
 * archive uses 12,000 times ("festival") drowned the rare one the person
 * actually named ("hornbill"). Rarity is the general fix: it applies to any
 * specific term outside the closed vocabulary, rather than needing every
 * festival, temple and market name added by hand.
 */
function textBoosts(terms: string[]): Map<string, number> {
  const boosts = new Map<string, number>();
  for (const term of terms) {
    const rarity = termRarity(term);
    // Name-collision filtering now lives in search.ts, so both this path and
    // the direct /search box get it from one place.
    const hits = search(term, 120);
    hits.forEach((hit, i) => {
      const value = (1 - i / hits.length) * rarity;
      /*
       * Accumulated, not maxed. Taking only a clip's best term meant matching
       * "hornbill" and "hornbill festival" scored exactly the same as matching
       * one of them, so a clip about a hornbill bird tied with the actual
       * Hornbill Festival. Satisfying more of what someone typed should count
       * for more.
       */
      boosts.set(hit.clip.id, (boosts.get(hit.clip.id) ?? 0) + value);
    });
  }

  // Capped so a clip repeating one idea across several terms cannot run away
  // with the ranking; it can be worth about two strong matches, not five.
  for (const [id, value] of boosts) boosts.set(id, Math.min(value, 2));
  return boosts;
}

/**
 * How specific naming a place is, on the same principle as term rarity.
 *
 * Flat place weighting treated "Delhi" (13,886 clips) and "Konark" (18) as
 * equally informative, so pairing a small place with a large one buried the
 * small one entirely — Delhi + Konark returned Delhi traffic and no Konark.
 * Naming somewhere the archive barely covers is a much stronger statement of
 * intent than naming its biggest city.
 *
 * Cached: this walks the clip list per place, and the answer never changes
 * within a process.
 */
const PLACE_REFERENCE = 3.6; // ~2,000 clips, a mid-sized city
const placeWeights = new Map<string, number>();

function placeWeight(placeId: string): number {
  const cached = placeWeights.get(placeId);
  if (cached !== undefined) return cached;

  const total = getAllClips().length;
  const count = getClipsForPlace(placeId).length;
  const idf = Math.log(1 + total / Math.max(count, 1));
  const weight = Math.min(1.6, Math.max(0.6, idf / PLACE_REFERENCE));

  placeWeights.set(placeId, weight);
  return weight;
}

type Scored = { clip: Clip; score: number; matchedPlace: boolean; textBoost: number };

function scoreAll(signals: Signals): Scored[] {
  const boosts = textBoosts(signals.terms);
  const out: Scored[] = [];

  for (const clip of getAllClips()) {
    let score = 0;
    let matchedPlace = false;

    if (clip.placeId) {
      const place = getPlace(clip.placeId);
      if (place) {
        if (signals.places.has(place.id)) {
          score += W.place * placeWeight(place.id);
          matchedPlace = true;
        } else if (signals.states.has(place.state)) {
          score += W.state;
          matchedPlace = true;
        } else if (signals.regions.has(place.region)) {
          score += W.region;
        }
        if (signals.terrains.has(place.terrain)) score += W.terrain;
      }
    }

    for (const subject of clip.subjects) {
      if (signals.subjects.has(subject)) score += W.subject;
    }

    const boost = boosts.get(clip.id) ?? 0;
    if (boost) score += boost * W.text;

    if (score > 0) out.push({ clip, score, matchedPlace, textBoost: boost });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * Round-robin by bucket so one strong signal cannot monopolise a row.
 *
 * Without this, "Mumbai" plus "railways" returned twenty near-identical
 * platform clips from one station — technically the best matches, and a dead
 * feed. Bucketing on place-plus-lead-subject keeps the ranking but forces
 * variety.
 */
function diversify(scored: Scored[], limit: number, perBucket = 2): Clip[] {
  const buckets = new Map<string, Clip[]>();
  for (const { clip } of scored) {
    const key = `${clip.placeId ?? 'nowhere'}:${clip.subjects[0] ?? 'untagged'}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(clip);
    else buckets.set(key, [clip]);
  }

  const queues = [...buckets.values()];
  const out: Clip[] = [];
  for (let round = 0; round < perBucket && out.length < limit; round++) {
    for (const queue of queues) {
      if (out.length >= limit) break;
      const clip = queue[round];
      if (clip) out.push(clip);
    }
  }
  return out;
}

export type Recommendation = {
  /** The opening row. Highest-scoring, varied. */
  firstPicks: Clip[];
  /** Matched a place the person actually named. */
  closeToHome: Clip[];
  /** Older-feeling footage from those same places. */
  remember: Clip[];
  /** Relevant, but outside the places they named. */
  further: Clip[];
  /** Long tail. */
  keepExploring: Clip[];
  places: { placeId: string; clips: number }[];
  subjects: { subject: Subject; count: number }[];
  signals: Signals;
  /** True when the answers produced too little to personalise honestly. */
  thin: boolean;
};

export function recommend(answers: Answers): Recommendation {
  const signals = interpret(answers);

  if (isEmpty(signals)) {
    return {
      firstPicks: [],
      closeToHome: [],
      remember: [],
      further: [],
      keepExploring: [],
      places: [],
      subjects: [],
      signals,
      thin: true,
    };
  }

  const scored = scoreAll(signals).filter((s) => isIndian(s.clip.placeId));

  const used = new Set<string>();
  const take = (pool: Scored[], limit: number, perBucket = 2) => {
    const picked = diversify(
      pool.filter((s) => !used.has(s.clip.id)),
      limit,
      perBucket,
    );
    for (const c of picked) used.add(c.id);
    return picked;
  };

  /*
   * The opening row reserves two slots for the free-text answers.
   *
   * Three of the five questions are place-type (parents, school, favourite
   * state) and the school question also implies a subject tag, so place signal
   * now stacks three ways against a single typed phrase. Measured across seven
   * combinations, the food or open answer reached the opening row in five —
   * but "Ambassador cars" alongside Punjab, Shimla and Himachal Pradesh scored
   * 9.5 against 15.2 for a tagged Shimla school clip and vanished from it.
   *
   * Weighting alone cannot fix that without making place answers useless, so
   * representation is guaranteed instead of hoped for: whatever else is true,
   * what someone typed in their own words appears near the top.
   */
  const firstPicks = take(scored, 7);
  const typedVoice = take(
    scored.filter((s) => s.textBoost > 0.4 && !s.matchedPlace),
    2,
    1,
  );
  firstPicks.splice(2, 0, ...typedVoice);
  const closeToHome = take(scored.filter((s) => s.matchedPlace), 8);
  const remember = take(
    scored.filter((s) => s.matchedPlace && s.clip.subjects.some((x) => NOSTALGIC.includes(x))),
    6,
  );

  /*
   * "Go a little further" is deliberately drawn from clips that matched on
   * interest but NOT on any place named — that is what makes it read as a
   * discovery rather than more of the same.
   */
  const further = take(scored.filter((s) => !s.matchedPlace), 10, 1);
  const keepExploring = take(scored, 16, 4);

  const placeTally = new Map<string, number>();
  const subjectTally = new Map<Subject, number>();
  for (const { clip } of scored) {
    if (clip.placeId) placeTally.set(clip.placeId, (placeTally.get(clip.placeId) ?? 0) + 1);
    for (const s of clip.subjects) subjectTally.set(s, (subjectTally.get(s) ?? 0) + 1);
  }

  const places = [...placeTally.entries()]
    .filter(([, n]) => n >= 12)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([placeId, clips]) => ({ placeId, clips }));

  const subjects = [...subjectTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([subject, count]) => ({ subject, count }));

  return {
    firstPicks,
    closeToHome,
    remember,
    further,
    keepExploring,
    places,
    subjects,
    signals,
    thin: scored.length < 40,
  };
}

/**
 * The editorial line under "Your India".
 *
 * Built only from vocabulary we actually resolved, so it can never claim to
 * have understood something it did not. Returns null rather than a vague
 * sentence when nothing was recognised.
 */
export function summarise(rec: Recommendation): string | null {
  /*
   * Only name places that can actually appear in the feed. Someone who lives
   * in London and grew up in Mumbai got "Footage selected around london,
   * mumbai…" — but the feed is filtered to Indian footage, so the London half
   * of that sentence described nothing on the page.
   */
  const placeNames = [...rec.signals.places]
    .map((id) => getPlace(id))
    .filter((p) => p?.country === 'India')
    .map((p) => p!.name);

  const stateNames = [...rec.signals.states];

  // Place names keep their capitalisation; subjects are lower-case nouns.
  const named = [...new Set([...placeNames, ...stateNames])].slice(0, 2);
  const subjects = [...rec.signals.subjects].slice(0, 3);

  /*
   * Answers we recognised nothing in are quoted back verbatim, so an
   * open-ended reply like "Ambassador cars" still gets an explanation line.
   *
   * Deliberately NOT drawn from `terms`: those are normalised, lower-cased and
   * often a fragment, which produced "village and Lanes." and "crafts and
   * Handloom." Anything that already yielded a place or a tag is described by
   * that tag instead, so nothing is said twice.
   *
   * No guard against nonsense is needed here: answers matching too little
   * never reach this function, because `thin` sends them to the generic feed.
   */
  const spoken = rec.signals.spoken.slice(0, 1);

  const parts = [...named, ...subjects, ...spoken];
  if (parts.length === 0) return null;

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return `Footage selected around ${list}.`;
}

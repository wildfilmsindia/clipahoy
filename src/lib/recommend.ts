import 'server-only';

import { getAllClips, getClipsForPlace, getPlace, isIndian } from './archive';
import { search, termRarity } from './search';
import { interpret, isEmpty, type Signals } from './interpret';
import { QUESTIONS, type Answers } from './taste';
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

/**
 * `withText` off skips the per-term BM25 boosting — the expensive part, up to
 * 24 full-index passes. The place-based sections (Close to home, the tallies,
 * the thin check) only need the structural signals, and the per-answer sources
 * do their own precise term search, so the global pass no longer pays for text
 * it does not use. This is what took a full 15-answer feed from ~1.7s to well
 * under half a second.
 */
function scoreAll(signals: Signals, withText = true): Scored[] {
  const boosts = withText ? textBoosts(signals.terms) : new Map<string, number>();
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

/* ----------------------------- per-answer breadth ------------------------- */

/**
 * One ranked clip list per answered question.
 *
 * The feed's job is to reflect everything the visitor typed, not just their
 * loudest answer. Scoring each answer on its own — then round-robining across
 * them — guarantees "favourite bird: peacock" earns a slot even when
 * "favourite festival: Durga Puja" (a rare word over a huge tag) would
 * otherwise sweep the entire opening row.
 */
type AnswerSource = { id: string; clips: Clip[] };

/**
 * A representative-quality ordering for clips that share a structural signal
 * but nothing to rank them by — every Kolkata clip has the same place score.
 * Prefer the ones a person actually named something else about (higher global
 * score), then the well-tagged and well-described, so a place answer leads
 * with a real Kolkata scene rather than whatever sat first in the array.
 */
function representativeRank(scoreById: Map<string, number>) {
  return (a: Clip, b: Clip) =>
    (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0) ||
    b.subjects.length - a.subjects.length ||
    b.title.length - a.title.length;
}

/** The clips one answer is about, most specific signal first, cheaply. */
function sourceClips(sig: Signals, rank: (a: Clip, b: Clip) => number): Clip[] {
  // The exact words typed, ranked by BM25 — precise for topic/open answers.
  // One search per answer, on the most specific (longest) term: "durga puja"
  // rather than also "durga". A second search per answer roughly doubled the
  // feed's render time for a phrase that adds nothing the first did not.
  if (sig.terms.length) {
    const term = sig.terms.reduce((a, b) => (b.length > a.length ? b : a));
    const out = search(term, 60)
      .map((h) => h.clip)
      .filter((c) => isIndian(c.placeId));
    if (out.length) return out;
  }
  // A named place, ranked for representativeness.
  if (sig.places.size) {
    return [...sig.places]
      .flatMap((id) => getClipsForPlace(id))
      .filter((c) => isIndian(c.placeId))
      .sort(rank);
  }
  if (sig.states.size) {
    return getAllClips()
      .filter((c) => c.placeId && sig.states.has(getPlace(c.placeId)?.state ?? ''))
      .sort(rank);
  }
  if (sig.subjects.size) {
    return getAllClips()
      .filter((c) => isIndian(c.placeId) && c.subjects.some((s) => sig.subjects.has(s)))
      .sort(rank);
  }
  if (sig.regions.size) {
    return getAllClips()
      .filter((c) => c.placeId && sig.regions.has(getPlace(c.placeId)?.region as never))
      .sort(rank);
  }
  return [];
}

function perAnswerSources(answers: Answers, rank: (a: Clip, b: Clip) => number): AnswerSource[] {
  const sources: AnswerSource[] = [];
  for (const q of QUESTIONS) {
    const text = answers[q.id]?.trim();
    if (!text) continue;
    const clips = sourceClips(interpret({ [q.id]: text }), rank);
    if (clips.length) sources.push({ id: q.id, clips });
  }
  return sources;
}

/**
 * Take clips fairly across sources: the best unused clip from each in turn,
 * cycling until `limit` is reached. In question order, so the opening row
 * reads as a tour of what the person told us, not a pile of one thing.
 */
function roundRobin(sources: AnswerSource[], limit: number, used: Set<string>): Clip[] {
  const out: Clip[] = [];
  const cursor = sources.map(() => 0);
  let advanced = true;
  while (out.length < limit && advanced) {
    advanced = false;
    for (let s = 0; s < sources.length && out.length < limit; s++) {
      const list = sources[s].clips;
      while (cursor[s] < list.length) {
        const c = list[cursor[s]++];
        if (!used.has(c.id)) {
          used.add(c.id);
          out.push(c);
          advanced = true;
          break;
        }
      }
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

  // Structural only (place/subject/region) — cheap, no term searches. Used for
  // the place-based sections, the tallies and the thin check.
  const scored = scoreAll(signals, false).filter((s) => isIndian(s.clip.placeId));

  const scoreById = new Map(scored.map((s) => [s.clip.id, s.score]));
  const sources = perAnswerSources(answers, representativeRank(scoreById));

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
   * Breadth first. The opening picks are drawn round-robin across every
   * answered question, so each thing the visitor typed is represented before
   * any one answer gets a second slot. This replaced a global top-score pick,
   * which handed all nine opening cards to whichever answer was rarest — a
   * specific festival swept the row while "peacock" and "monsoon" never
   * appeared at all.
   */
  const firstPicks = roundRobin(sources, 18, used);

  // The place-named cut and the nostalgic cut are genuine direct matches, kept.
  const closeToHome = take(scored.filter((s) => s.matchedPlace), 8);
  const remember = take(
    scored.filter((s) => s.matchedPlace && s.clip.subjects.some((x) => NOSTALGIC.includes(x))),
    6,
  );

  // More of the visitor's own matches, still round-robin so it stays varied
  // rather than collapsing back onto one loud answer.
  const keepExploring = roundRobin(sources, 16, used);

  /*
   * Discovery is padding, and padding is only wanted when the direct matches
   * are thin. When the answers already fill the page it is suppressed; when
   * the visitor gave little — few answers, short feed — it fills the gap with
   * interest-matched footage from outside the places they named.
   */
  const rich = sources.length >= 4 && firstPicks.length + closeToHome.length >= 16;
  const further = rich ? [] : roundRobin(sources, 10, used);

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

  /*
   * Thin means "too little to personalise honestly", measured over everything
   * the answers reach — not just the structural pass, which is empty for a
   * purely free-text answer set like "Ambassador cars" that still has hundreds
   * of real matches.
   */
  const reach = new Set(scored.map((s) => s.clip.id));
  for (const src of sources) for (const c of src.clips) reach.add(c.id);

  return {
    firstPicks,
    closeToHome,
    remember,
    further,
    keepExploring,
    places,
    subjects,
    signals,
    thin: reach.size < 40,
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

  /*
   * Regions count too. "Which part of India would you most like to explore?"
   * resolves to a compass region, and leaving it out meant answering "The
   * Northeast" produced correct results under a summary line that mentioned
   * nothing at all.
   */
  const regionNames = [...rec.signals.regions].map((r) =>
    r === 'Northeast' ? 'the Northeast' : `${r.toLowerCase()} India`,
  );

  // Place names keep their capitalisation; subjects are lower-case nouns.
  const named = [...new Set([...placeNames, ...stateNames, ...regionNames])].slice(0, 3);
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

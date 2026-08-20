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

/* ------------------------------ per-answer picks -------------------------- */

/**
 * The feed is a set of small playlists, one per question answered.
 *
 * Everything the visitor typed gets its own row of up to five clips — fewer if
 * that is all the archive genuinely holds, never more. Earlier versions mixed
 * every answer into one long ranked feed and then padded it out with loosely
 * related "discovery" footage, which read as random. Grouping by answer means
 * every clip on the page can be traced to something the person actually said.
 */
export const PER_ANSWER = 5;

export type AnswerGroup = {
  questionId: string;
  /** The question, for the section heading. */
  prompt: string;
  /** What they typed, shown back to them verbatim. */
  answer: string;
  clips: Clip[];
  /**
   * Whether the archive holds more than the five shown.
   *
   * Deliberately a boolean, not a count: the candidate pool is capped at the
   * search limit, so any number taken from it would be "at least N" dressed up
   * as a total. The link says "more", not a figure it cannot stand behind.
   */
  hasMore: boolean;
};

/** Words worth requiring in a title. Articles carry no evidence. */
const TITLE_NOISE = new Set(['the', 'and', 'of', 'in', 'at', 'a', 'an', 'my', 'for', 'to']);

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !TITLE_NOISE.has(w));
}

/**
 * Every answer is ranked by BM25 over title and prose, including place answers.
 *
 * Place answers used to bypass search and sort the place's tagged clips by a
 * hand-rolled "representativeness" heuristic. That surfaced whatever happened
 * to be tagged rather than what the place is known for: Mumbai led with two
 * celebrity interviews that merely carried a Mumbai tag. Ranking by the words
 * instead gives Kerala houseboats, Varanasi ghats and Mumbai rush hour.
 *
 * A clip only qualifies on EVIDENCE, not on a passing mention:
 *
 *   - the answer's words appear in the TITLE, which in this archive describes
 *     what the camera saw, or
 *   - for a place answer, the clip is actually tagged with that place.
 *
 * Prose-only matches are dropped. Asking for "Nowruz" used to return Ladakh
 * polo and a militant attack, because all four clips mentioning the word do so
 * in passing — "festive occasions like Losar and Nowruz". The archive holds no
 * Nowruz footage, and an empty row says that honestly where five wrong clips
 * did not. Measured across two dozen answers, real subjects keep 15–20 of
 * their top 20; Nowruz was the only one that kept none.
 */
function sourceClips(sig: Signals, answer: string): Clip[] {
  const query = sig.terms.length
    ? sig.terms.reduce((a, b) => (b.length > a.length ? b : a))
    : answer;

  const ranked = search(query, 80)
    .map((h) => h.clip)
    .filter((c) => isIndian(c.placeId));

  const needles = meaningfulWords(answer);
  const inTitle = (c: Clip) => {
    const title = c.title.toLowerCase();
    return needles.length > 0 && needles.every((w) => title.includes(w));
  };
  const atPlace = (c: Clip) => !!c.placeId && sig.places.has(c.placeId);

  // Title matches lead; place-tagged footage without the name written in the
  // title still counts, since the tag is independent evidence.
  const strong = [...ranked.filter(inTitle), ...ranked.filter((c) => !inTitle(c) && atPlace(c))];
  if (strong.length >= PER_ANSWER) return strong;

  // Thin on written evidence: top up from the gazetteer, which is a tag rather
  // than a guess, before giving up on the answer.
  if (sig.places.size) {
    const tagged = [...sig.places]
      .flatMap((id) => getClipsForPlace(id))
      .filter((c) => isIndian(c.placeId) && !strong.some((o) => o.id === c.id));
    if (strong.length + tagged.length > 0) return [...strong, ...tagged];
  }

  if (strong.length) return strong;

  /*
   * No title or place evidence at all. Structural tags are still trustworthy —
   * they were assigned by the extractor, not inferred from one word in a
   * paragraph — so a state, subject or region answer can still fill a row.
   */
  if (sig.states.size) {
    return getAllClips().filter((c) => c.placeId && sig.states.has(getPlace(c.placeId)?.state ?? ''));
  }
  if (sig.subjects.size) {
    return getAllClips().filter(
      (c) => isIndian(c.placeId) && c.subjects.some((s) => sig.subjects.has(s)),
    );
  }
  if (sig.regions.size) {
    return getAllClips().filter((c) => c.placeId && sig.regions.has(getPlace(c.placeId)?.region as never));
  }

  // The archive mentions the word but has no footage of it. Say nothing.
  return [];
}

/* ------------------------------ shoot diversity --------------------------- */

/**
 * Words that identify a particular shoot rather than a subject.
 *
 * A day's filming produces fifteen or twenty clips of one location, and their
 * titles repeat: "People enjoying haleem and biryani", "…at Nizamuddin",
 * "Street food of Nizamuddin: Haleem and Biryani". Overlap on these words is
 * the cheapest reliable signal that two clips came from the same session.
 */
function shootWords(clip: Clip): Set<string> {
  return new Set(meaningfulWords(clip.title));
}

/** Jaccard overlap of title words, nudged up when the place matches too. */
function shootSimilarity(a: Clip, b: Clip): number {
  const wa = shootWords(a);
  const wb = shootWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;

  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  const jaccard = shared / (wa.size + wb.size - shared);

  // Same place is weak on its own — most biryani in this archive is Delhi —
  // so it only sharpens a title overlap rather than standing in for one.
  const samePlace = a.placeId && a.placeId === b.placeId ? 0.1 : 0;
  return Math.min(1, jaccard + samePlace);
}

/**
 * Pick `limit` clips that are all on-topic but not all the same shoot.
 *
 * Straight relevance order gave five clips of one afternoon: every biryani row
 * was the Nizamuddin haleem stall, every Kerala row a backwater houseboat.
 * Ranking still decides who is eligible — this only decides which of the
 * eligible ones get the slots.
 *
 * Two guards, because they catch different things:
 *
 *   - pairwise title overlap, which catches near-identical captions;
 *   - a cap on any one distinctive word, which catches a shoot whose titles
 *     are worded differently but keep naming the same thing. Four of five
 *     biryani clips said "haleem" while sitting below the overlap threshold,
 *     because each phrased the rest of the sentence its own way.
 *
 * Both relax in passes, so a genuinely repetitive subject still fills its row
 * rather than being punished for the archive's shape.
 */
function diverseTake(candidates: Clip[], limit: number, taken: Set<string>, query: string): Clip[] {
  const picked: Clip[] = [];
  const asked = new Set(meaningfulWords(query));
  const wordUse = new Map<string, number>();

  const passes: { ceiling: number; perWord: number }[] = [
    { ceiling: 0.34, perWord: 2 },
    { ceiling: 0.6, perWord: 3 },
    { ceiling: 1.01, perWord: limit },
  ];

  for (const { ceiling, perWord } of passes) {
    for (const clip of candidates) {
      if (picked.length >= limit) break;
      if (taken.has(clip.id) || picked.some((p) => p.id === clip.id)) continue;

      if (picked.some((p) => shootSimilarity(clip, p) > ceiling)) continue;

      // Words the visitor asked for are expected in every title and are not
      // evidence of repetition; everything else is.
      const own = meaningfulWords(clip.title).filter((w) => !asked.has(w));
      if (own.some((w) => (wordUse.get(w) ?? 0) >= perWord)) continue;

      for (const w of own) wordUse.set(w, (wordUse.get(w) ?? 0) + 1);
      picked.push(clip);
    }
    if (picked.length >= limit) break;
  }

  return picked;
}

/**
 * Build one capped playlist per answered question, in the order asked.
 *
 * De-duplicated across groups: a clip that already appeared for "favourite
 * animal: elephant" will not appear again under "dream wildlife experience".
 * Each group keeps drawing down its own ranked list until it has five of its
 * own, so an overlap costs a later group depth rather than its whole row.
 */
function answerGroups(answers: Answers): AnswerGroup[] {
  const groups: AnswerGroup[] = [];
  const used = new Set<string>();

  for (const q of QUESTIONS) {
    const answer = answers[q.id]?.trim();
    if (!answer) continue;

    const pool = sourceClips(interpret({ [q.id]: answer }), answer);
    if (pool.length === 0) continue;

    // `used` spans every row, so a clip shown under one answer never reappears
    // under another — the page never repeats itself.
    const clips = diverseTake(pool, PER_ANSWER, used, answer);
    for (const c of clips) used.add(c.id);
    if (clips.length) {
      groups.push({
        questionId: q.id,
        prompt: q.prompt,
        answer,
        clips,
        hasMore: pool.length > clips.length,
      });
    }
  }

  return groups;
}

export type Recommendation = {
  /** One capped playlist per answered question, in the order asked. */
  groups: AnswerGroup[];
  places: { placeId: string; clips: number }[];
  subjects: { subject: Subject; count: number }[];
  signals: Signals;
  /** True when the answers produced too little to personalise honestly. */
  thin: boolean;
};

export function recommend(answers: Answers): Recommendation {
  const signals = interpret(answers);

  if (isEmpty(signals)) {
    return { groups: [], places: [], subjects: [], signals, thin: true };
  }

  const groups = answerGroups(answers);

  /*
   * The browse tiles under the playlists come from a structural pass — place
   * and subject tallies over everything the answers touch. Cheap: no term
   * searches, one walk of the clip array.
   */
  const scored = scoreAll(signals, false).filter((s) => isIndian(s.clip.placeId));

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
   * Thin means "too little to personalise honestly", measured on what the
   * playlists actually hold rather than on how much the archive could reach.
   */
  const total = groups.reduce((n, g) => n + g.clips.length, 0);

  return { groups, places, subjects, signals, thin: groups.length === 0 || total < 3 };
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

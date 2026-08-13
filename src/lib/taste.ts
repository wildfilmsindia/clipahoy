/**
 * The five questions, and the shape of what a person types.
 *
 * Answers are now free text, not option ids. Someone should be able to write
 * "sea and mountains" or "old railway stations" without having learned this
 * archive's 34-word subject vocabulary — interpret.ts does that translation.
 *
 * Imported by both the client (to render) and the server (to score), so it
 * must stay free of any archive import.
 */

import type { Subject } from './types';

/**
 * Which suggestion pool backs a question.
 *
 * `open` deliberately has none: question 5 is the one most likely to name
 * something outside the closed subject vocabulary, and it should reach the
 * BM25 fallback rather than be steered back toward words we already know.
 */
export type QuestionKind = 'place' | 'state' | 'food' | 'open';

export type TasteQuestion = {
  id: string;
  /** Small line above the question. */
  eyebrow: string;
  prompt: string;
  /** One sentence under the prompt, in Clipahoy's voice. */
  support: string;
  placeholder: string;
  /** Shown under the field as tappable hints. Secondary to typing. */
  examples: string[];
  /** Which vocabulary powers autocomplete. */
  kind: QuestionKind;
  /**
   * Subject tags this question implies regardless of what is typed.
   *
   * "Where did you go to school?" names a place, but the reason for asking is
   * the schooling, and the archive has a `school` tag with 1,341 clips. Without
   * this, answering "Shimla" here would be indistinguishable from answering it
   * anywhere else.
   */
  implies?: Subject[];
};

/** Bump when the question set changes, so stale cookies are discarded. */
export const TASTE_VERSION = 5;
export const TASTE_COOKIE = 'clipahoy_taste';

/** Free text, keyed by question id. */
export type Answers = Record<string, string>;

export type StoredTaste = { v: number; a: Answers };

export const QUESTIONS: TasteQuestion[] = [
  {
    id: 'parents',
    eyebrow: "Let's get to know your India",
    prompt: 'Where are your parents from?',
    support: 'The place that comes up at every family gathering.',
    placeholder: 'A town, a district, a state…',
    examples: ['Kerala', 'Punjab', 'Bengal', 'Tamil Nadu'],
    kind: 'place',
  },
  {
    id: 'want',
    eyebrow: 'The reason you are here',
    prompt: 'What do you want to see?',
    support: 'Anything at all. This is the one where you can go off the map.',
    placeholder: 'Say it however you like…',
    // 'Steam engines' was dropped: it matched too little and fell through to
    // the generic feed. Every chip here was run through the recommender first.
    examples: ['Old Bombay', 'Ambassador cars', 'Handloom weaving', 'Monsoon streets'],
    kind: 'open',
  },
  {
    id: 'food',
    eyebrow: 'The thing you miss first',
    prompt: 'What is your favourite food?',
    support: 'A dish, a stall, or just the smell of a particular street.',
    placeholder: 'Biryani, street food, sweets…',
    // 'Fish curry' was dropped: 13 clips, not enough to personalise on.
    examples: ['Street food', 'Biryani', 'Sweets', 'Chaat'],
    kind: 'food',
  },
  {
    id: 'school',
    eyebrow: 'Where the day started',
    prompt: 'Where did you go to school?',
    support: 'The town will do — we are after the place, not the school.',
    placeholder: 'City, town, hill station…',
    examples: ['Shimla', 'Darjeeling', 'Dehradun', 'Kolkata'],
    kind: 'place',
    // The archive has a `school` tag (1,341 clips), so this question can mean
    // more than "another place": it pulls classrooms and playgrounds there.
    implies: ['school'],
  },
  {
    id: 'state',
    eyebrow: 'One more',
    prompt: "What's your favourite Indian state?",
    support: 'The coarsest question we ask — a whole state, not a street.',
    placeholder: 'Pick a state…',
    examples: ['Rajasthan', 'Kerala', 'Assam', 'Himachal Pradesh'],
    kind: 'state',
  },
];

/* ------------------------------------------------------------------ cookie */

export function encodeTaste(answers: Answers): string {
  return encodeURIComponent(JSON.stringify({ v: TASTE_VERSION, a: answers } satisfies StoredTaste));
}

/**
 * Never throws. A malformed or stale cookie is treated as "no answers yet"
 * rather than as an error page — the worst case is being asked again.
 */
export function decodeTaste(raw: string | undefined): Answers | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as StoredTaste;
    if (parsed?.v !== TASTE_VERSION || typeof parsed.a !== 'object' || parsed.a === null) {
      return null;
    }
    const clean: Answers = {};
    for (const q of QUESTIONS) {
      const value = parsed.a[q.id];
      // Cap length: this is free text arriving from a cookie.
      if (typeof value === 'string' && value.trim()) clean[q.id] = value.trim().slice(0, 120);
    }
    return clean;
  } catch {
    return null;
  }
}

/** True when at least one question was actually answered. */
export function hasAnswers(answers: Answers | null): boolean {
  return !!answers && Object.values(answers).some((v) => v.trim().length > 0);
}

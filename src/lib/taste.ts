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

/**
 * Which suggestion pool backs a question.
 *
 * `open` deliberately has none: question 5 is the one most likely to name
 * something outside the closed subject vocabulary, and it should reach the
 * BM25 fallback rather than be steered back toward words we already know.
 */
export type QuestionKind = 'place' | 'festival' | 'street' | 'open';

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
};

/** Bump when the question set changes, so stale cookies are discarded. */
export const TASTE_VERSION = 4;
export const TASTE_COOKIE = 'clipahoy_taste';

/** Free text, keyed by question id. */
export type Answers = Record<string, string>;

export type StoredTaste = { v: number; a: Answers };

export const QUESTIONS: TasteQuestion[] = [
  {
    id: 'live',
    eyebrow: "Let's get to know your India",
    prompt: 'Where do you live?',
    support: 'Start with somewhere that already feels ordinary to you.',
    placeholder: 'Tell us your city…',
    examples: ['Mumbai', 'Delhi', 'Bengaluru', 'Kolkata'],
    kind: 'place',
  },
  {
    id: 'roots',
    eyebrow: 'Where you come from',
    prompt: 'Where did you grow up?',
    support: 'A town, a district, a state — whatever comes to mind first.',
    placeholder: 'City, town, village…',
    examples: ['Bombay', 'Kerala', 'Darjeeling', 'Jaipur'],
    kind: 'place',
  },
  {
    id: 'festival',
    eyebrow: 'The loudest week of the year',
    prompt: 'What festival do you remember the most?',
    support: 'The one you could hear from your street before you could see it.',
    placeholder: 'Durga Puja, Holi…',
    examples: ['Durga Puja', 'Holi', 'Ganesh Chaturthi', 'Kumbh Mela'],
    kind: 'festival',
  },
  {
    id: 'streets',
    eyebrow: 'The walk you knew by heart',
    prompt: 'What kind of streets do you remember?',
    support: 'Markets, quiet lanes, something else entirely.',
    placeholder: 'Markets, quiet lanes…',
    examples: ['Street markets', 'Village lanes', 'Hill roads', 'Old town streets'],
    kind: 'street',
  },
  {
    id: 'curious',
    eyebrow: 'One more',
    prompt: 'What are you curious to see now?',
    support: 'Anything at all. This is the one where you can go off the map.',
    placeholder: 'Say it however you like…',
    examples: ['Old cinemas', 'Ambassador cars', 'Handloom weaving', 'Paan shops'],
    kind: 'open',
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

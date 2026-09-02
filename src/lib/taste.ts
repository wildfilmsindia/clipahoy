/**
 * The onboarding questions, and the shape of what a person types.
 *
 * Answers are free text. Someone should be able to write "sea and mountains"
 * or "old railway stations" without having learned this archive's 34-word
 * subject vocabulary — interpret.ts does that translation.
 *
 * Imported by both the client (to render) and the server (to score), so it
 * must stay free of any archive import.
 */

import type { Subject } from './types';

/**
 * How an answer is interpreted, not what it is about.
 *
 * Only four values, because this drives behaviour rather than labelling: place
 * and state do gazetteer lookups, region resolves compass words, `topic` is a
 * narrow subject question, and `open` is deliberately unguided. Landscape words
 * are read out of the first four but not out of `topic` — "seafood" should not
 * become a coastline.
 */
export type QuestionKind = 'place' | 'state' | 'region' | 'topic' | 'open';

export type TasteQuestion = {
  id: string;
  /** Small line above the question. */
  eyebrow: string;
  prompt: string;
  /**
   * The line under the prompt telling someone what kind of answer works.
   *
   * Deliberately a list of *categories* rather than named answers ("a town,
   * district, state, village…"), because the earlier design put four concrete
   * example chips under every field and they read as the permitted set rather
   * than as suggestions. Anything can be typed here, and this line should say
   * so by naming shapes of answer instead of answers.
   *
   * Rendered as visible text rather than as the field's placeholder: these run
   * to eighty-odd characters and the field is a single line of 2rem display
   * type, so as a placeholder they were silently clipped mid-sentence.
   */
  hint: string;
  kind: QuestionKind;
  /**
   * Autocomplete list for questions whose vocabulary is a fixed set rather
   * than the gazetteer. Curated here because these are short, stable lists;
   * places and states come from the archive at request time instead.
   *
   * Every entry was counted in the corpus before being offered — see the
   * counts beside each list.
   */
  suggest?: string[];
  /**
   * Words this question understands as meaning something else.
   *
   * Not spelling repair — both sides are correctly spelled — but a different
   * word for the same thing, where the archive consistently uses one of them.
   * "Fall" under *favourite season* returned Jog Falls and Kynrem Falls, four
   * waterfalls and no autumn, because this archive writes autumn as "autumn":
   * `fall` retrieves 500 waterfall clips, `autumn` retrieves the Chinar trees
   * in Kashmir and the Garhwal morning.
   *
   * Applied per word against the typed answer, and only for its own question,
   * so "fall" keeps its ordinary meaning everywhere else. What the visitor
   * typed is still what gets shown back to them.
   */
  aliases?: Record<string, string>;
  /**
   * Subject tags this question implies regardless of what is typed.
   *
   * "Where did you go to school?" names a place, but the reason for asking is
   * the schooling, and the archive has a `school` tag with 1,341 clips. Without
   * this, answering "Shimla" here would be indistinguishable from answering it
   * anywhere else.
   */
  implies?: Subject[];
  /**
   * What the question is *about*, used to disambiguate the answer.
   *
   * A bare word means different things in different questions. "Crane" under
   * "favourite bird" returned construction cranes at Paradeep Port; "rice"
   * under "favourite food" returned paddy cultivation; "hornbill" under
   * "favourite festival" returned the bird rather than the Nagaland festival.
   *
   * A clip is in context if it carries one of `subjects` OR mentions one of
   * `words`. Tags alone are not enough — plenty of real matches are untagged —
   * and words alone are not enough either, since a correct clip may simply not
   * repeat the category noun.
   *
   * `notWords` overrides both, matched against the TITLE only. It exists
   * because the subject tags are noisy: "Crane vessel unloading shipment at
   * Paradeep Port" is tagged `birds`, so no amount of positive evidence keeps
   * it out. Naming the wrong sense is the only reliable way past a bad tag.
   */
  context?: { subjects?: Subject[]; words?: string[]; notWords?: string[] };
};

// Bumped to 7 when the set went from fifteen questions to ten: five ids were
// removed, so a v6 cookie holds answers to questions that no longer exist.
export const TASTE_VERSION = 7;
export const TASTE_COOKIE = 'clipahoy_taste';

/** Free text, keyed by question id. */
export type Answers = Record<string, string>;

export type StoredTaste = { v: number; a: Answers };

export const QUESTIONS: TasteQuestion[] = [
  {
    id: 'grewup',
    eyebrow: "Let's get to know your India",
    prompt: 'Where were you born?',
    hint: 'A town, district, state, village, or any place you remember…',
    kind: 'place',
  },
  {
    id: 'parents',
    eyebrow: 'One generation back',
    prompt: 'Where are your parents from?',
    hint: 'Any place your family calls home…',
    kind: 'place',
  },
  {
    id: 'school',
    eyebrow: 'Where the day started',
    prompt: 'Where did you go to school?',
    hint: 'A school, town, district, or even a place you remember growing up…',
    kind: 'place',
    // The archive has a `school` tag (1,341 clips), so this means more than
    // "another place": it pulls classrooms and playgrounds there.
    implies: ['school'],
  },
  {
    id: 'explore',
    eyebrow: 'Somewhere you have not been',
    prompt: 'Which part of India would you most like to explore?',
    hint: "A state, city, region, village, or anywhere you've always wanted to see…",
    kind: 'region',
    suggest: [
      'North India', 'South India', 'East India', 'West India', 'Central India',
      'The Northeast', 'The Himalayas', 'The coast', 'The desert', 'The backwaters',
    ],
  },
  {
    id: 'food',
    eyebrow: 'The thing you miss first',
    prompt: 'What is your favourite food?',
    hint: 'A dish, snack, dessert, drink, or something that reminds you of home…',
    kind: 'topic',
    // sweets 1,005 · street food 475 · biryani 127 · thali 59 · momos 48
    suggest: [
      'Street food', 'Sweets', 'Biryani', 'Chaat', 'Thali', 'Momos',
      'Samosa', 'Paan', 'Dosa', 'Mithai', 'Chai', 'Kebabs', 'Pakoda',
    ],
    context: {
      subjects: ['street food'],
      words: ['food', 'eat', 'eating', 'dish', 'cook', 'cooking', 'meal', 'snack', 'stall', 'restaurant', 'cuisine', 'kitchen', 'serve', 'serving', 'vendor', 'delicacy', 'taste', 'tasty', 'recipe', 'drink', 'beer', 'sweet', 'plate'],
      // Growing an ingredient is not the food someone means. "Rice" returned
      // paddy cultivation and husking rather than anything on a plate.
      notWords: ['cultivation', 'farming', 'farmer', 'paddy', 'plantation', 'crop', 'harvest', 'sowing', 'field', 'husking', 'pounding', 'mill'],
    },
  },
  {
    id: 'animal',
    eyebrow: 'Creatures great and small',
    prompt: 'What is your favourite animal?',
    hint: 'A pet, a wild animal, or any creature you have always loved…',
    kind: 'topic',
    // elephant 935 · tiger 754 · leopard 680 · deer 608 · camel 418
    suggest: [
      'Elephant', 'Tiger', 'Leopard', 'Deer', 'Camel', 'Snow leopard',
      'Monkey', 'Langur', 'Rhino', 'Buffalo', 'Nilgai', 'Blackbuck',
    ],
    context: {
      subjects: ['wildlife', 'livestock', 'forest'],
      words: ['wildlife', 'animal', 'sanctuary', 'reserve', 'jungle', 'forest', 'herd', 'wild', 'habitat', 'safari', 'park'],
      notWords: ['vessel', 'shipment', 'cargo', 'port', 'deck', 'container', 'construction', 'machinery', 'lifting', 'consignment'],
    },
  },
  {
    id: 'festival',
    eyebrow: 'Colour, noise and celebration',
    prompt: 'What is your favourite festival?',
    hint:
      'A festival, celebration, or tradition from any faith or culture you look forward to…',
    kind: 'topic',
    // Durga Puja 959 · Kumbh Mela 926 · Holi 757 · Dussehra 556 · Diwali 499
    suggest: [
      'Durga Puja', 'Kumbh Mela', 'Holi', 'Rath Yatra', 'Dussehra', 'Diwali',
      'Ganesh Chaturthi', 'Hornbill Festival', 'Chhath Puja', 'Bihu', 'Navratri',
      'Pushkar Fair', 'Onam', 'Pongal', 'Baisakhi', 'Lohri',
    ],
    context: {
      subjects: ['festival', 'ceremony'],
      words: ['festival', 'mela', 'puja', 'celebration', 'celebrate', 'procession', 'parade', 'festivities', 'ritual', 'devotee', 'pilgrim'],
    },
  },
  {
    id: 'flower',
    eyebrow: 'Everything in bloom',
    prompt: 'What is your favourite flower?',
    hint: 'A wildflower, garden flower, tree blossom, or anything that blooms…',
    kind: 'topic',
    // rose 446 · rhododendron 351 · lotus 180 · orchid 177 · marigold 147
    suggest: [
      'Lotus', 'Rhododendron', 'Marigold', 'Rose', 'Orchid', 'Sunflower',
      'Jasmine', 'Tulip', 'Bougainvillea',
    ],
    context: {
      subjects: ['flowers'],
      words: ['flower', 'bloom', 'blossom', 'petal', 'garden', 'floral', 'plant', 'nursery'],
    },
  },
  {
    id: 'bird',
    eyebrow: 'Look up',
    prompt: 'What is your favourite bird?',
    hint:
      "A bird you see every day, one from your childhood, or one you've always wanted to see…",
    kind: 'topic',
    // hornbill 654 · crane 281 · peacock 262 · bulbul 208 · kingfisher 193
    suggest: [
      'Peacock', 'Hornbill', 'Crane', 'Kingfisher', 'Bulbul', 'Woodpecker',
      'Parakeet', 'Eagle', 'Myna', 'Flamingo', 'Owl', 'Stork', 'Heron',
    ],
    context: {
      subjects: ['birds'],
      words: ['bird', 'nest', 'perch', 'wing', 'feather', 'beak', 'plumage', 'avian', 'birding', 'flock', 'sanctuary'],
      // "Crane" is also cargo machinery, and the port clips are tagged `birds`.
      notWords: ['vessel', 'shipment', 'cargo', 'port', 'deck', 'container', 'construction', 'machinery', 'lifting', 'consignment', 'crane operator'],
    },
  },
  {
    id: 'season',
    eyebrow: 'The turn of the year',
    prompt: 'What is your favourite season?',
    hint: 'Summer, monsoon, winter, spring, or any season you prefer…',
    kind: 'topic',
    // winter 2,975 · monsoon 2,258 · summer 1,909 · spring 1,742 · harvest 641
    suggest: ['Monsoon', 'Winter', 'Summer', 'Spring', 'Autumn', 'Harvest', 'Snowfall'],
    // "fall" is 500 waterfalls here; "rains"/"rainy" is what everyone outside
    // the archive calls the monsoon.
    aliases: { fall: 'autumn', rains: 'monsoon', rainy: 'monsoon' },
    context: {
      subjects: ['monsoon', 'snow'],
      words: ['season', 'weather', 'rain', 'monsoon', 'winter', 'summer', 'spring', 'climate', 'harvest'],
    },
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

/* ------------------------------------------------------------------ share */

/**
 * Answers, packed into something that survives a URL.
 *
 * The whole curated feed is a pure function of the answers, so the answers ARE
 * the shareable object — there is no server-side record to point at, nothing to
 * store, and a link keeps working with no account behind it.
 *
 * Compact on purpose: keys are dropped in favour of question order, so the
 * payload is the answers separated by `~` rather than a JSON object repeating
 * every id. Ten answers come to roughly 120 characters encoded, which keeps the
 * link inside what messaging apps will show without truncating.
 *
 * base64url, because a raw `?a=` value would carry the visitor's own words,
 * and seeing them urlencoded in the address bar invites editing them by hand
 * into something that was never a real answer.
 */
const SHARE_SEPARATOR = '~';

export function encodeShare(answers: Answers): string {
  // Positional, so the reader must use the same question order — the version
  // prefix is what makes a mismatch detectable rather than silently wrong.
  const ordered = QUESTIONS.map((q) => (answers[q.id] ?? '').replace(/~/g, ' ').trim());

  // Trailing blanks carry no information.
  while (ordered.length && !ordered[ordered.length - 1]) ordered.pop();

  const payload = `${TASTE_VERSION}${SHARE_SEPARATOR}${ordered.join(SHARE_SEPARATOR)}`;
  return Buffer.from(payload, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Never throws. A truncated, edited or stale link is treated as "no answers",
 * which lands on the ordinary onboarding rather than an error page.
 */
export function decodeShare(param: string | undefined): Answers | null {
  if (!param) return null;
  // A hand-lengthened link is not worth decoding; this caps the work done on
  // anything arriving from outside.
  if (param.length > 2000) return null;

  try {
    const base64 = param.replace(/-/g, '+').replace(/_/g, '/');
    const payload = Buffer.from(base64, 'base64').toString('utf8');
    const parts = payload.split(SHARE_SEPARATOR);

    const version = Number(parts.shift());
    if (version !== TASTE_VERSION) return null;

    const answers: Answers = {};
    QUESTIONS.forEach((q, i) => {
      const value = parts[i]?.trim();
      if (value) answers[q.id] = value.slice(0, 120);
    });

    return hasAnswers(answers) ? answers : null;
  } catch {
    return null;
  }
}

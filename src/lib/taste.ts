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
  /** One sentence under the prompt, in Clipahoy's voice. */
  support: string;
  placeholder: string;
  /** Shown under the field as tappable hints. Secondary to typing. */
  examples: string[];
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
   * Subject tags this question implies regardless of what is typed.
   *
   * "Where did you go to school?" names a place, but the reason for asking is
   * the schooling, and the archive has a `school` tag with 1,341 clips. Without
   * this, answering "Shimla" here would be indistinguishable from answering it
   * anywhere else.
   */
  implies?: Subject[];
};

export const TASTE_VERSION = 6;
export const TASTE_COOKIE = 'clipahoy_taste';

/** Free text, keyed by question id. */
export type Answers = Record<string, string>;

export type StoredTaste = { v: number; a: Answers };

export const QUESTIONS: TasteQuestion[] = [
  {
    id: 'grewup',
    eyebrow: "Let's get to know your India",
    prompt: 'Where did you grow up?',
    support: 'The place you stopped noticing because you saw it every day.',
    placeholder: 'A town, a district, a state…',
    examples: ['Kerala', 'Punjab', 'Bengal', 'Tamil Nadu'],
    kind: 'place',
  },
  {
    id: 'parents',
    eyebrow: 'One generation back',
    prompt: 'Where are your parents from?',
    support: 'The place that comes up at every family gathering.',
    placeholder: 'City, town, village…',
    examples: ['Bihar', 'Rajasthan', 'Gujarat', 'Assam'],
    kind: 'place',
  },
  {
    id: 'school',
    eyebrow: 'Where the day started',
    prompt: 'Where did you go to school?',
    support: 'The town will do — we are after the place, not the school.',
    placeholder: 'City, town, hill station…',
    examples: ['Shimla', 'Darjeeling', 'Dehradun', 'Kolkata'],
    kind: 'place',
    // The archive has a `school` tag (1,341 clips), so this means more than
    // "another place": it pulls classrooms and playgrounds there.
    implies: ['school'],
  },
  {
    id: 'explore',
    eyebrow: 'Somewhere you have not been',
    prompt: 'Which part of India would you most like to explore?',
    support: 'A direction is enough.',
    placeholder: 'North, south, the hills…',
    examples: ['The Northeast', 'South India', 'The Himalayas', 'Central India'],
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
    support: 'A dish, a stall, or the smell of a particular street.',
    placeholder: 'Biryani, street food, sweets…',
    examples: ['Street food', 'Biryani', 'Sweets', 'Chaat'],
    kind: 'topic',
    // sweets 1,005 · street food 475 · biryani 127 · thali 59 · momos 48
    suggest: [
      'Street food', 'Sweets', 'Biryani', 'Chaat', 'Thali', 'Momos',
      'Samosa', 'Paan', 'Dosa', 'Mithai', 'Chai', 'Kebabs', 'Pakoda',
    ],
  },
  {
    id: 'animal',
    eyebrow: 'Out in the open',
    prompt: 'What is your favourite animal?',
    support: 'Anything with four legs, or none.',
    placeholder: 'Elephant, tiger, camel…',
    examples: ['Elephant', 'Tiger', 'Leopard', 'Camel'],
    kind: 'topic',
    // elephant 935 · tiger 754 · leopard 680 · deer 608 · camel 418
    suggest: [
      'Elephant', 'Tiger', 'Leopard', 'Deer', 'Camel', 'Snow leopard',
      'Monkey', 'Langur', 'Rhino', 'Buffalo', 'Nilgai', 'Blackbuck',
    ],
  },
  {
    id: 'favplace',
    eyebrow: 'The one you send people to',
    prompt: 'What is your favourite place in India?',
    support: 'A city, a hill station, a stretch of coast.',
    placeholder: 'Anywhere at all…',
    examples: ['Varanasi', 'Ladakh', 'Goa', 'Jaipur'],
    kind: 'place',
  },
  {
    id: 'festival',
    eyebrow: 'The loudest week of the year',
    prompt: 'What is your favourite festival?',
    support: 'The one you could hear from your street before you could see it.',
    placeholder: 'Durga Puja, Holi…',
    examples: ['Durga Puja', 'Holi', 'Ganesh Chaturthi', 'Kumbh Mela'],
    kind: 'topic',
    // Durga Puja 959 · Kumbh Mela 926 · Holi 757 · Dussehra 556 · Diwali 499
    suggest: [
      'Durga Puja', 'Kumbh Mela', 'Holi', 'Rath Yatra', 'Dussehra', 'Diwali',
      'Ganesh Chaturthi', 'Hornbill Festival', 'Chhath Puja', 'Bihu', 'Navratri',
      'Pushkar Fair', 'Onam', 'Pongal', 'Baisakhi', 'Lohri',
    ],
  },
  {
    id: 'flower',
    eyebrow: 'Small things',
    prompt: 'What is your favourite flower?',
    support: 'Garden, roadside or hillside.',
    placeholder: 'Lotus, marigold…',
    examples: ['Lotus', 'Rhododendron', 'Marigold', 'Rose'],
    kind: 'topic',
    // rose 446 · rhododendron 351 · lotus 180 · orchid 177 · marigold 147
    suggest: [
      'Lotus', 'Rhododendron', 'Marigold', 'Rose', 'Orchid', 'Sunflower',
      'Jasmine', 'Tulip', 'Bougainvillea',
    ],
  },
  {
    id: 'bird',
    eyebrow: 'Look up',
    prompt: 'What is your favourite bird?',
    support: 'Common or rare — both are in here.',
    placeholder: 'Peacock, kingfisher…',
    examples: ['Peacock', 'Hornbill', 'Kingfisher', 'Flamingo'],
    kind: 'topic',
    // hornbill 654 · crane 281 · peacock 262 · bulbul 208 · kingfisher 193
    suggest: [
      'Peacock', 'Hornbill', 'Crane', 'Kingfisher', 'Bulbul', 'Woodpecker',
      'Parakeet', 'Eagle', 'Myna', 'Flamingo', 'Owl', 'Stork', 'Heron',
    ],
  },
  {
    id: 'wildlife',
    eyebrow: 'If you could choose',
    prompt: 'What is your dream wildlife experience?',
    support: 'Say it however you like. This one can go off the map.',
    placeholder: 'Describe it…',
    examples: ['Tiger safari', 'Snow leopard', 'Bird migration', 'Elephant herd'],
    kind: 'open',
  },
  {
    id: 'season',
    eyebrow: 'The turn of the year',
    prompt: 'What is your favourite season?',
    support: 'The weather you would pick if you could.',
    placeholder: 'Monsoon, winter…',
    examples: ['Monsoon', 'Winter', 'Spring', 'Harvest'],
    kind: 'topic',
    // winter 2,975 · monsoon 2,258 · summer 1,909 · spring 1,742 · harvest 641
    suggest: ['Monsoon', 'Winter', 'Summer', 'Spring', 'Autumn', 'Harvest', 'Snowfall'],
  },
  {
    id: 'city',
    eyebrow: 'Streets and crowds',
    prompt: 'What is your favourite Indian city?',
    support: 'Big or small, old or new.',
    placeholder: 'Name a city…',
    examples: ['Mumbai', 'Kolkata', 'Varanasi', 'Jaipur'],
    kind: 'place',
  },
  {
    id: 'tradition',
    eyebrow: 'Passed down',
    prompt: 'What is one Indian tradition you love?',
    support: 'A craft, a ritual, a way of doing something.',
    placeholder: 'Say it however you like…',
    examples: ['Handloom', 'Pottery', 'Yoga', 'Rangoli'],
    kind: 'open',
  },
  {
    id: 'interest',
    eyebrow: 'Last one',
    prompt: 'What are you interested in — music, dance, cinema, sport, culture?',
    support: 'Pick whichever fits, or name your own.',
    placeholder: 'Music, dance, cinema…',
    examples: ['Classical dance', 'Folk music', 'Cinema', 'Cricket'],
    kind: 'topic',
    // folk dance 562 · cricket 503 · classical dance 481 · classical music 423
    suggest: [
      'Classical dance', 'Folk dance', 'Classical music', 'Folk music', 'Cinema',
      'Cricket', 'Wrestling', 'Kabaddi', 'Handloom', 'Pottery', 'Yoga',
      'Bharatanatyam', 'Kathakali', 'Rangoli',
    ],
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

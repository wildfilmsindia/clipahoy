import type { Clip, Place, Subject } from './types';

/**
 * Turn a clip into ONE sentence describing what is in it.
 *
 * A result must never render as a pile of disconnected fields — "Delhi",
 * "rain", "2019" as three chips tells a viewer nothing about the footage.
 * The audit (AUDIT.md §E) found the archive's titles are written by humans
 * for humans, descriptive rather than templated, and almost always already a
 * usable sentence: "Monsoon clouds over Darma Valley in the Kumaon Himalaya".
 * So the title is the primary source and the template is only a fallback.
 *
 * Dates are deliberately absent. AUDIT.md §F: there is no filming-date field
 * anywhere in the corpus, and 71.3% of clips carry no date signal at all.
 * `Clip.year` is inferred from text and is never shown.
 */

/** Noun phrases for the fallback template. Chosen to read as English. */
const SUBJECT_PHRASE: Record<Subject, string> = {
  railway: 'Trains and railway',
  bazaar: 'Market and bazaar',
  river: 'River and waterways',
  school: 'Schools',
  temple: 'Temples',
  monsoon: 'Monsoon rain',
  farmland: 'Farmland',
  'street food': 'Street food',
  bus: 'Buses',
  coastline: 'The coast',
  hills: 'Hills',
  festival: 'Festival',
  wildlife: 'Wildlife',
  'old town': 'The old town',
  highway: 'Roads and highways',
  dance: 'Dance',
  music: 'Music',
  ceremony: 'A ceremony',
  village: 'Village life',
  flowers: 'Flowers',
  forest: 'Forest',
  fort: 'A fort',
  aerial: 'Aerial views',
  crafts: 'Craft and handiwork',
  industry: 'Industry and work',
  sport: 'Sport',
  politics: 'A political gathering',
  snow: 'Snow',
  birds: 'Birds',
  livestock: 'Livestock',
  architecture: 'Buildings',
  boats: 'Boats',
  desert: 'Desert',
  lake: 'A lake',
};

/**
 * Production noise seen in real titles during the metadata-shape sample —
 * tape/disc identifiers and archive housekeeping that leaked into public
 * metadata. Stripped so a result never surfaces "MPCL DISC 2 FOOTAGE".
 */
const NOISE_PATTERNS: RegExp[] = [
  /\bSG\s*\d+\b/gi,
  /\bMPCL\b/gi,
  /\bDISC\s*\d+\b/gi,
  /\bTAPE\s*\d+\b/gi,
  /\bREEL\s*\d+\b/gi,
  /\bFOOTAGE\s*$/i,
  /\b(?:HD|4K|1080i?|HDCAM)\b/g,
  /#\S+/g,
  // Company self-branding written into titles: "at wildfilmsindia Jabbarkhet
  // gardens" reads better as "at Jabbarkhet gardens". Dropped because it
  // describes the rights-holder, not the footage.
  /\bwild\s?films\s?india\b/gi,
];

/**
 * Note on years: a year written INTO a title by a human ("Bihar Flood 2020")
 * is left intact. That is part of what the clip shows and was authored by
 * someone who knew. It is not the same as `Clip.year`, which this module
 * never reads and the UI never renders — that field is inferred from text and
 * absent for 71.3% of the corpus (AUDIT.md §F).
 */

function clean(title: string): string {
  let t = title;
  for (const re of NOISE_PATTERNS) t = t.replace(re, ' ');

  // Pipes are used as a delimiter between a headline and a restatement of the
  // same thing. Keep the first, richest segment rather than concatenating.
  if (t.includes('|')) {
    const parts = t.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length) t = parts.reduce((a, b) => (b.length > a.length ? b : a));
  }

  return t
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .replace(/^[\s\-–—:,.]+|[\s\-–—:,]+$/g, '')
    .trim();
}

/**
 * Is the cleaned title good enough to show on its own? Thin titles are
 * usually a bare species name or a leftover code, which read as a label
 * rather than a description.
 */
function isUsable(t: string): boolean {
  if (t.length < 20) return false;
  const words = t.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 4) return false;

  /*
   * Script check, deliberately Unicode-aware.
   *
   * This originally tested /[a-z]{3}/ to reject ALL-CAPS labels. That quietly
   * failed every Devanagari and Bengali title in the corpus — none contain
   * Latin lowercase — so ~900 perfectly good Hindi titles were being discarded
   * and replaced by a template, which then rendered a spurious subject tag as
   * the whole description ("Roads and highways in Mizoram" for a clip about
   * hand-thrown pottery). Non-Latin titles are now trusted on length alone;
   * the all-caps test applies only where it means something.
   */
  if (/[^\p{Script=Latin}\p{N}\p{P}\p{Z}]/u.test(t)) return true;
  return /[a-z]{3}/.test(t);
}

function mentionsPlace(text: string, place: Place | undefined): boolean {
  if (!place) return false;
  const hay = text.toLowerCase();
  return (
    hay.includes(place.name.toLowerCase()) ||
    hay.includes(place.state.toLowerCase()) ||
    hay.includes(place.district.toLowerCase())
  );
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The one sentence shown to the user.
 *
 * 1. Clean the title and use it if it stands on its own.
 * 2. Otherwise fall back to `{subject phrase} in {place}`.
 * 3. Either way, append the place if the sentence doesn't already name it,
 *    so a result always says where it is without a separate location chip.
 */
export function describeClip(clip: Clip, place?: Place): string {
  const cleaned = clean(clip.title);

  let sentence: string;

  if (isUsable(cleaned)) {
    sentence = cleaned;
  } else {
    const subject = clip.subjects?.[0];
    const phrase = subject ? SUBJECT_PHRASE[subject] : 'Archive footage';
    sentence = place ? `${phrase} in ${place.name}` : phrase;
    // Already placed by the template; return before the append step.
    return capitalise(sentence);
  }

  /*
   * Append the place only for Latin-script sentences.
   *
   * Grafting English ", in Visakhapatnam" onto a Devanagari sentence — after a
   * danda, no less — reads as two languages collided. Non-Latin titles instead
   * let the separate location line carry the place, which it does correctly:
   * mentionsPlace() can't match a transliterated name across scripts, so the
   * location line falls through to the fuller "Town, State" form.
   */
  const isLatin = !/[^\p{Script=Latin}\p{N}\p{P}\p{Z}]/u.test(sentence);
  if (isLatin && place && !mentionsPlace(sentence, place)) {
    // Strip terminal punctuation first: "…scaredy-cat leopard!, in Rajasthan"
    // reads as a typo.
    sentence = `${sentence.replace(/[.,;:!?]+$/, '')}, in ${place.name}`;
  }

  return capitalise(sentence);
}

/**
 * Secondary line: where it is, as prose rather than tags. Returns null when
 * the sentence already carries the place, so nothing is said twice.
 */
export function describeLocation(clip: Clip, place?: Place, sentence?: string): string | null {
  if (!place) return null;
  const s = sentence ?? describeClip(clip, place);
  const named = s.toLowerCase().includes(place.name.toLowerCase());

  /*
   * Outside India, lead with the country — it is the part a reader needs, and
   * "Bagmati" alone tells almost nobody anything. Renders "Kathmandu, Nepal",
   * or just "Nepal" for a country-level row. Non-India footage is in the
   * archive on purpose (AUDIT.md §K), so it gets a real location line rather
   * than a blank one.
   */
  if (place.country && place.country !== 'India') {
    if (place.name === place.country) return named ? null : place.country;
    return named ? place.country : `${place.name}, ${place.country}`;
  }

  // If the sentence names the town, the state still adds something.
  if (named) return place.name === place.state ? null : place.state;
  return place.name === place.state ? place.state : `${place.name}, ${place.state}`;
}

/**
 * The rights-holder boilerplate appended to most descriptions.
 *
 * Every clip's prose ends with the same paragraph about the size of the
 * Wilderness Films collection and the formats it was shot on. It is true, and
 * it is identical across 73k records, so as card copy it is pure noise — the
 * hover blurb was opening with "This footage is part of the broadcast stock
 * footage archive of…" instead of saying anything about the clip.
 */
const BOILERPLATE = /\s*(?:This (?:footage|video) is part of|The collection comprises)\b[\s\S]*$/i;

/** Description prose with the shared marketing tail removed. Null if nothing is left. */
export function blurb(text: string, limit = 240): string | null {
  const trimmed = text.replace(BOILERPLATE, '').trim();
  if (trimmed.length < 40) return null;
  if (trimmed.length <= limit) return trimmed;
  // Cut on a sentence end where possible so the blurb does not stop mid-clause.
  const cut = trimmed.slice(0, limit);
  const stop = cut.lastIndexOf('. ');
  return (stop > 90 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…');
}

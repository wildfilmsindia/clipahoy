import 'server-only';

import { getPlaces } from './archive';
import { type Region, type Subject, type Terrain } from './types';
import { QUESTIONS, type Answers, type QuestionKind } from './taste';

/**
 * Turns what a person typed into archive signals.
 *
 * The point is that nobody should have to learn this archive's vocabulary.
 * Someone writes "sea and mountains" or "old railway stations in Bombay"; this
 * resolves that to terrain=coastal+hills, subjects=coastline/hills/railway/old
 * town, place=mumbai, and leaves the rest as free text for BM25.
 *
 * Everything here maps onto vocabularies that actually exist in the data —
 * SUBJECTS is closed, places come from the gazetteer. Nothing is invented.
 */

/**
 * Historical and colonial names people still use. All targets verified present.
 *
 * Exported because the search box needs the same knowledge: resolving "Bombay"
 * to Mumbai for the onboarding feed while leaving `/search?q=Bombay` to find
 * only the 955 clips that spell it the old way is the same fact applied in one
 * place and not the other.
 */
export const PLACE_ALIASES: Record<string, string> = {
  bombay: 'mumbai',
  calcutta: 'kolkata',
  madras: 'chennai',
  bangalore: 'bengaluru',
  poona: 'pune',
  benares: 'varanasi',
  banaras: 'varanasi',
  kashi: 'varanasi',
  cochin: 'kochi',
  trivandrum: 'thiruvananthapuram',
  mysore: 'mysuru',
  simla: 'shimla',
  ootacamund: 'ooty',
  pondicherry: 'puducherry',
  baroda: 'vadodara',
  cawnpore: 'kanpur',
};

/**
 * Everyday words for the closed subject vocabulary.
 *
 * Longer phrases are matched first, so "street food" beats "street" and
 * "old town" beats "old".
 */
const SUBJECT_WORDS: Record<string, Subject[]> = {
  'street food': ['street food'],
  'old town': ['old town'],
  'old city': ['old town'],
  'old cities': ['old town'],
  'railway station': ['railway'],
  'railway stations': ['railway'],
  'train station': ['railway'],
  'birds eye': ['aerial'],

  train: ['railway'],
  trains: ['railway'],
  railway: ['railway'],
  railways: ['railway'],
  rail: ['railway'],
  station: ['railway'],
  locomotive: ['railway'],

  market: ['bazaar'],
  markets: ['bazaar'],
  bazaar: ['bazaar'],
  bazaars: ['bazaar'],
  mandi: ['bazaar'],
  shops: ['bazaar'],
  shopping: ['bazaar'],

  river: ['river'],
  rivers: ['river'],
  ganga: ['river'],
  ganges: ['river'],
  backwaters: ['river', 'boats'],

  school: ['school'],
  schools: ['school'],
  classroom: ['school'],
  students: ['school'],

  temple: ['temple'],
  temples: ['temple'],
  mandir: ['temple'],
  shrine: ['temple'],
  mosque: ['temple', 'architecture'],
  church: ['temple', 'architecture'],

  monsoon: ['monsoon'],
  rain: ['monsoon'],
  rains: ['monsoon'],
  rainy: ['monsoon'],

  farm: ['farmland'],
  farms: ['farmland'],
  farming: ['farmland'],
  fields: ['farmland'],
  agriculture: ['farmland'],
  paddy: ['farmland'],

  food: ['street food'],
  eating: ['street food'],
  cooking: ['street food'],
  snacks: ['street food'],
  chai: ['street food'],
  tea: ['street food'],

  bus: ['bus'],
  buses: ['bus'],
  rickshaw: ['bus'],
  auto: ['bus'],
  tram: ['bus'],
  trams: ['bus'],
  traffic: ['highway', 'bus'],

  coast: ['coastline'],
  coastal: ['coastline'],
  coastline: ['coastline'],
  sea: ['coastline'],
  ocean: ['coastline'],
  beach: ['coastline'],
  beaches: ['coastline'],
  shore: ['coastline'],
  seaside: ['coastline'],

  mountain: ['hills'],
  mountains: ['hills'],
  hill: ['hills'],
  hills: ['hills'],
  himalaya: ['hills', 'snow'],
  himalayas: ['hills', 'snow'],
  himalayan: ['hills', 'snow'],
  ghats: ['hills'],

  festival: ['festival'],
  festivals: ['festival'],
  mela: ['festival'],
  puja: ['festival', 'ceremony'],
  procession: ['festival'],
  diwali: ['festival'],
  holi: ['festival'],

  wildlife: ['wildlife'],
  animals: ['wildlife'],
  tiger: ['wildlife'],
  tigers: ['wildlife'],
  elephant: ['wildlife'],
  elephants: ['wildlife'],
  leopard: ['wildlife'],
  safari: ['wildlife'],

  heritage: ['old town', 'architecture'],
  historic: ['old town'],
  historical: ['old town'],
  vintage: ['old town'],
  colonial: ['old town', 'architecture'],
  ancient: ['old town', 'fort'],

  highway: ['highway'],
  highways: ['highway'],
  road: ['highway'],
  roads: ['highway'],
  street: ['highway'],
  streets: ['highway'],

  dance: ['dance'],
  dancing: ['dance'],
  dancers: ['dance'],

  music: ['music'],
  musicians: ['music'],
  singing: ['music'],
  song: ['music'],
  songs: ['music'],

  ceremony: ['ceremony'],
  wedding: ['ceremony'],
  weddings: ['ceremony'],
  ritual: ['ceremony'],
  rituals: ['ceremony'],

  village: ['village'],
  villages: ['village'],
  rural: ['village', 'farmland'],
  countryside: ['village', 'farmland'],

  flowers: ['flowers'],
  flower: ['flowers'],
  garden: ['flowers'],
  gardens: ['flowers'],
  blossom: ['flowers'],

  forest: ['forest'],
  forests: ['forest'],
  jungle: ['forest'],
  woods: ['forest'],

  fort: ['fort'],
  forts: ['fort'],
  palace: ['fort', 'architecture'],
  palaces: ['fort', 'architecture'],

  aerial: ['aerial'],
  drone: ['aerial'],
  skyline: ['aerial', 'architecture'],

  crafts: ['crafts'],
  craft: ['crafts'],
  handicraft: ['crafts'],
  weaving: ['crafts'],
  pottery: ['crafts'],
  artisan: ['crafts'],

  industry: ['industry'],
  factory: ['industry'],
  factories: ['industry'],
  mill: ['industry'],
  mills: ['industry'],
  industrial: ['industry'],

  sport: ['sport'],
  sports: ['sport'],
  cricket: ['sport'],
  football: ['sport'],

  politics: ['politics'],
  political: ['politics'],
  election: ['politics'],
  rally: ['politics'],
  protest: ['politics'],

  snow: ['snow'],
  snowy: ['snow'],
  glacier: ['snow'],

  birds: ['birds'],
  bird: ['birds'],
  birding: ['birds'],

  cattle: ['livestock'],
  cows: ['livestock'],
  goats: ['livestock'],
  buffalo: ['livestock'],
  livestock: ['livestock'],

  architecture: ['architecture'],
  buildings: ['architecture'],
  building: ['architecture'],
  monument: ['architecture', 'fort'],
  monuments: ['architecture', 'fort'],

  boat: ['boats'],
  boats: ['boats'],
  ferry: ['boats'],
  ship: ['boats'],
  ships: ['boats'],
  fishing: ['boats', 'coastline'],

  desert: ['desert'],
  dunes: ['desert'],
  thar: ['desert'],

  lake: ['lake'],
  lakes: ['lake'],

  // Common asks with no matching tag — carried as free text instead.
  cinema: [],
  bollywood: [],
  film: [],
  films: [],
  movie: [],
  movies: [],
};

const TERRAIN_WORDS: Record<string, Terrain[]> = {
  mountain: ['hills'],
  mountains: ['hills'],
  hill: ['hills'],
  hills: ['hills'],
  himalaya: ['hills'],
  himalayas: ['hills'],
  coast: ['coastal'],
  coastal: ['coastal'],
  sea: ['coastal'],
  ocean: ['coastal'],
  beach: ['coastal'],
  beaches: ['coastal'],
  seaside: ['coastal'],
  river: ['river valley', 'delta'],
  rivers: ['river valley', 'delta'],
  delta: ['delta'],
  desert: ['desert'],
  dunes: ['desert'],
  plains: ['dry plains'],
  plateau: ['plateau'],
};

/**
 * Short forms of state names people actually type. Resolved to the state, not
 * to a town, so "Bengal" behaves like "West Bengal" instead of falling through
 * to free text and flooding results with Bay-of-Bengal coastline.
 */
const STATE_ALIASES: Record<string, string> = {
  bengal: 'West Bengal',
  'tamilnadu': 'Tamil Nadu',
  orissa: 'Odisha',
  uttaranchal: 'Uttarakhand',
  pondicherry: 'Puducherry',
};

const REGION_WORDS: Record<string, Region> = {
  'north india': 'North',
  'northern india': 'North',
  'south india': 'South',
  'southern india': 'South',
  'east india': 'East',
  'eastern india': 'East',
  'west india': 'West',
  'western india': 'West',
  'central india': 'Central',
  northeast: 'Northeast',
  'north east': 'Northeast',
  'the northeast': 'Northeast',
};

/** Words that carry no retrieval value on their own. */
const STOP = new Set([
  'the','a','an','and','or','of','in','on','at','to','for','with','from','by','my','me','i',
  'is','are','was','were','be','some','any','all','more','like','want','see','seeing','watch',
  'india','indian','something','anything','stuff','things','thing','kind','sort','bit','little',
  'somewhere','else','around','near','also','really','very','just','about','lot','lots','back',
  'grew','up','live','living','born','home','feel','feels','curious','explore','mood','old',
]);

export type Signals = {
  places: Set<string>;
  states: Set<string>;
  regions: Set<Region>;
  terrains: Set<Terrain>;
  subjects: Set<Subject>;
  terms: string[];
  /** Human-readable list of what we understood, for the "because" line. */
  understood: string[];
  /**
   * Answers that produced no place, terrain or subject at all — pure free
   * text, kept verbatim. The summary uses these rather than the normalised
   * leftovers, which are often a fragment of the phrase the person typed:
   * "Durga Puja" hands `puja` to the subject tag and leaves `durga` behind.
   */
  spoken: string[];
};

function emptySignals(): Signals {
  return {
    places: new Set(),
    states: new Set(),
    regions: new Set(),
    terrains: new Set(),
    subjects: new Set(),
    terms: [],
    understood: [],
    spoken: [],
  };
}

/** name -> id, built once. Includes state names and the alias table. */
let placeLookup: Map<string, { placeId?: string; state?: string }> | null = null;

function lookup(): Map<string, { placeId?: string; state?: string }> {
  if (placeLookup) return placeLookup;

  const map = new Map<string, { placeId?: string; state?: string }>();
  for (const place of getPlaces()) {
    map.set(place.name.toLowerCase(), { placeId: place.id });
    // A state name resolves to the whole state rather than one town.
    if (!map.has(place.state.toLowerCase())) {
      map.set(place.state.toLowerCase(), { state: place.state });
    }
  }
  for (const [alias, id] of Object.entries(PLACE_ALIASES)) {
    if (!map.has(alias)) map.set(alias, { placeId: id });
  }

  placeLookup = map;
  return map;
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Scan a phrase for known vocabulary, longest match first.
 *
 * Longest-first matters: "street food" must not be consumed as "street", and
 * "north india" must not be consumed as "india".
 */
function scan(text: string, kind: QuestionKind, out: Signals): boolean {
  const words = normalise(text).split(' ').filter(Boolean);
  if (words.length === 0) return false;

  /*
   * Tracked as a flag, not by comparing set sizes before and after. Sizes miss
   * a match that adds nothing new: answering "Chennai" then "Madras" resolves
   * both to the same place id, so the sets do not grow and the second answer
   * looked unrecognised — which got it quoted back verbatim in the summary as
   * though we had not understood it.
   */
  let matchedAnything = false;

  const places = lookup();
  const consumed = new Array<boolean>(words.length).fill(false);

  for (let size = Math.min(4, words.length); size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      if (consumed.slice(i, i + size).some(Boolean)) continue;
      const phrase = words.slice(i, i + size).join(' ');

      let hit = false;

      const region = REGION_WORDS[phrase];
      if (region) {
        out.regions.add(region);
        out.understood.push(phrase);
        hit = true;
      }

      if (!hit) {
        const stateAlias = STATE_ALIASES[phrase];
        if (stateAlias) {
          out.states.add(stateAlias);
          out.understood.push(phrase);
          hit = true;
        }
      }

      if (!hit) {
        const place = places.get(phrase);
        /*
         * On a narrow subject question, a place name that covers only PART of
         * the answer is a modifier, not the subject.
         *
         * "Shimla mirch" is capsicum. Matching "shimla" on its own resolved the
         * hill station, and because a Shimla-tagged street-food clip is on
         * topic for *favourite food* while "Shimla Mirch or Capsicum" is not —
         * "capsicum" being absent from the food vocabulary — the row came back
         * as one kebab filmed in Shimla, with all seven capsicum clips beaten.
         *
         * The same reasoning the terrain rule below already uses: these are
         * narrow subject questions, so geography has to earn the whole answer
         * before it is believed. Answering a topic question with a bare place
         * name still resolves, since then the phrase IS the answer.
         */
        const partialPlace = kind === 'topic' && size < words.length;
        if (place && !partialPlace) {
          if (place.placeId) out.places.add(place.placeId);
          if (place.state) out.states.add(place.state);
          out.understood.push(phrase);
          hit = true;
        }
      }

      if (!hit) {
        const terrains = TERRAIN_WORDS[phrase];
        const subjects = SUBJECT_WORDS[phrase];
        /*
         * Landscape words are read out of geography questions and the
         * open-ended ones, where "the hills" or "the coast" is an ordinary
         * thing to type. Not out of `topic`: those are narrow subject
         * questions, and "seafood" should not resolve to a coastline.
         */
        if (terrains && kind !== 'topic') {
          for (const t of terrains) out.terrains.add(t);
          hit = true;
        }
        if (subjects) {
          for (const s of subjects) out.subjects.add(s);
          /*
           * The phrase becomes a search term as well as a tag.
           *
           * Consuming it into the tag alone made every festival identical:
           * "Holi" and "Diwali" both collapsed to `festival` and returned the
           * same generic mela footage, with none of the 757 clips that
           * actually say Holi reachable. The tag gives breadth, the term gives
           * the specific thing that was asked for.
           */
          out.terms.push(phrase);
          hit = true;
        }
        if (hit) out.understood.push(phrase);
      }

      if (hit) {
        matchedAnything = true;
        for (let k = i; k < i + size; k++) consumed[k] = true;
      }
    }
  }

  // Whatever is left and looks meaningful becomes free text for BM25.
  const leftover = words.filter((w, i) => !consumed[i] && w.length > 2 && !STOP.has(w));
  if (leftover.length) out.terms.push(leftover.join(' '));

  /*
   * Short answers are also searched whole.
   *
   * Matching splits a phrase across tables — "Dal Lake" gives `lake` to the
   * subject tag and leaves `dal` to be searched alone, which retrieved
   * lentils and the Janata Dal party. "Hornbill Festival" left `hornbill`,
   * which retrieved the bird. Searching the intact phrase fixes both, because
   * search.ts requires every token of a one- or two-term query to be present,
   * so only clips containing the actual phrase survive.
   *
   * Capped at three words: beyond that the majority rule makes a whole-phrase
   * query too strict to match anything.
   */
  if (words.length >= 2 && words.length <= 3) out.terms.push(words.join(' '));

  return matchedAnything;
}

/** Full interpretation across all five answers. */
export function interpret(answers: Answers): Signals {
  const out = emptySignals();
  for (const q of QUESTIONS) {
    const text = answers[q.id]?.trim();
    if (!text) continue;
    const structured = scan(text, q.kind, out);
    // Question-level implications (see TasteQuestion.implies).
    if (q.implies) for (const subject of q.implies) out.subjects.add(subject);
    // Only wholly-unrecognised answers are quoted back in the summary.
    if (!structured) out.spoken.push(text);
  }

  // Deduplicate while keeping order. Capped because every term costs one pass
  // over the BM25 index — but the cap has to clear the question count, or the
  // later questions' words are silently dropped. At 8 (set when there were
  // five questions) a fifteen-question run lost monsoon, handloom and more.
  out.terms = [...new Set(out.terms)].slice(0, 24);
  out.understood = [...new Set(out.understood)];
  out.spoken = [...new Set(out.spoken)];
  return out;
}

/** True when we found nothing usable — used to fall back to the generic feed. */
export function isEmpty(signals: Signals): boolean {
  return (
    signals.places.size === 0 &&
    signals.states.size === 0 &&
    signals.regions.size === 0 &&
    signals.terrains.size === 0 &&
    signals.subjects.size === 0 &&
    signals.terms.length === 0
  );
}

/**
 * Autocomplete vocabulary, sent to the client once.
 *
 * Small enough to ship as props (a few hundred short strings), which avoids an
 * API round-trip per keystroke and keeps suggestions in step with the data.
 */
export function suggestionVocabulary(): { places: string[]; states: string[] } {
  const places = new Set<string>();
  const states = new Set<string>();
  for (const place of getPlaces()) {
    if (place.country !== 'India') continue;
    places.add(place.name);
    places.add(place.state);
    states.add(place.state);
  }

  /*
   * Historical names belong in autocomplete too. Someone who types "Bomb"
   * means Bombay and should see it offered — the interpreter already resolves
   * it to mumbai, but without this the field looked like it knew nothing.
   */
  for (const alias of Object.keys(PLACE_ALIASES)) {
    places.add(alias.charAt(0).toUpperCase() + alias.slice(1));
  }

  /*
   * Only the gazetteer-backed lists are built here. Food, animals, birds,
   * flowers, seasons, festivals and interests are fixed sets that live on the
   * questions themselves in taste.ts, so the client gets them without a second
   * payload and they stay next to the copy they belong to.
   */
  return { places: [...places].sort(), states: [...states].sort() };
}

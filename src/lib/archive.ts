import 'server-only';

import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

import {
  SUBJECTS,
  type ArchiveFile,
  type Clip,
  type Place,
  type Subject,
} from './types';

/* ---------------------------------------------------------------------------
 * THE ONE LINE.
 *
 * Everything downstream reads the archive through this module, so switching
 * from hand-written seed data to the real ingested index is this single edit:
 *
 *   const ARCHIVE_FILE = 'index.json';
 *
 * Nothing else in the app needs to change. `scripts/ingest.ts` writes
 * data/index.json in exactly the shape of data/seed.json.
 * ------------------------------------------------------------------------- */
const ARCHIVE_FILE = 'index.json';

const SUBJECT_SET = new Set<string>(SUBJECTS);

type Archive = {
  source: string;
  places: Place[];
  clips: Clip[];
  placesById: Map<string, Place>;
  clipsById: Map<string, Clip>;
  clipsByPlace: Map<string, Clip[]>;
};

function load(): Archive {
  const file = path.join(process.cwd(), 'data', ARCHIVE_FILE);

  /*
   * The archive ships gzipped.
   *
   * Raw, index.json is 112 MB — past GitHub's 100 MB file limit, so the repo
   * could not carry its own data and every deploy started by failing to find
   * it. gzip takes it to 20 MB, which commits normally, with no loss at all:
   * truncating the prose instead was measured and cost 0.8pp of search
   * precision (99.4% -> 98.6%) while only reaching 63 MB.
   *
   * The plain file still wins when present, so local work after an ingest
   * needs no extra step. `npm run pack-archive` produces the .gz.
   */
  const gzFile = `${file}.gz`;
  let raw: string;

  if (existsSync(file)) {
    raw = readFileSync(file, 'utf8');
  } else if (existsSync(gzFile)) {
    raw = gunzipSync(readFileSync(gzFile)).toString('utf8');
  } else {
    throw new Error(
      `Missing data/${ARCHIVE_FILE} and data/${ARCHIVE_FILE}.gz.\n\n` +
        `Restore from a backup, or rebuild:\n` +
        `  npm run ingest -- --offline   # re-extract from data/.ingest-cache.jsonl\n\n` +
        `See STATUS.md.`,
    );
  }

  const parsed = JSON.parse(raw) as ArchiveFile;

  const placeIds = new Set(parsed.places.map((p) => p.id));

  // Defensive dedupe. A resumed crawl can overlap a page boundary and emit
  // the same video twice; duplicates then collide as React keys and clips
  // silently vanish from the grid. The ingest dedupes too, but the loader is
  // the last place to catch it before it reaches the UI.
  const byId = new Map<string, Clip>();
  for (const clip of parsed.clips) {
    if (!byId.has(clip.id)) byId.set(clip.id, clip);
  }
  const duplicates = parsed.clips.length - byId.size;
  if (duplicates > 0) {
    console.warn(`[archive] dropped ${duplicates} duplicate clip id(s) from ${ARCHIVE_FILE}`);
  }
  parsed.clips = [...byId.values()];

  // Fail loudly at boot rather than silently serving a broken archive: a
  // subject outside the controlled vocabulary is a data error, not a warning.
  for (const clip of parsed.clips) {
    // placeId is null for legitimately unplaceable footage (wildlife, nature).
    if (clip.placeId !== null && !placeIds.has(clip.placeId)) {
      throw new Error(`Clip ${clip.id} references unknown place "${clip.placeId}"`);
    }
    for (const subject of clip.subjects) {
      if (!SUBJECT_SET.has(subject)) {
        throw new Error(`Clip ${clip.id} uses subject "${subject}" outside the vocabulary`);
      }
    }
    // A real YouTube ID is 11 characters. If something that looks like one
    // shows up while isPlaceholder is true, the data is lying about itself.
    if (clip.isPlaceholder && !clip.id.startsWith('SEED_')) {
      throw new Error(`Clip ${clip.id} is marked placeholder but has a non-SEED id`);
    }
  }

  const clipsByPlace = new Map<string, Clip[]>();
  for (const clip of parsed.clips) {
    if (clip.placeId === null) continue;
    const list = clipsByPlace.get(clip.placeId);
    if (list) list.push(clip);
    else clipsByPlace.set(clip.placeId, [clip]);
  }

  // Coverage is derived, never authored, so it cannot drift out of sync with
  // the clips it describes.
  const places: Place[] = parsed.places.map((raw) => {
    const coverage: Partial<Record<Subject, number>> = {};
    for (const clip of clipsByPlace.get(raw.id) ?? []) {
      for (const subject of clip.subjects) {
        coverage[subject] = (coverage[subject] ?? 0) + 1;
      }
    }
    return { ...raw, coverage };
  });

  return {
    source: parsed.source,
    places,
    clips: parsed.clips,
    placesById: new Map(places.map((p) => [p.id, p])),
    clipsById: new Map(parsed.clips.map((c) => [c.id, c])),
    clipsByPlace,
  };
}

let cached: Archive | null = null;

function archive(): Archive {
  if (!cached) cached = load();
  return cached;
}

/* --------------------------------- reads -------------------------------- */

export function getSource(): string {
  return archive().source;
}

export function getPlaces(): Place[] {
  return archive().places;
}

export function getPlace(id: string): Place | undefined {
  return archive().placesById.get(id);
}

export function getClip(id: string): Clip | undefined {
  return archive().clipsById.get(id);
}

export function getClips(ids: string[]): Clip[] {
  const { clipsById } = archive();
  return ids.map((id) => clipsById.get(id)).filter((c): c is Clip => Boolean(c));
}

export function getClipsForPlace(placeId: string): Clip[] {
  return archive().clipsByPlace.get(placeId) ?? [];
}

export function getAllClips(): Clip[] {
  return archive().clips;
}

/* ------------------------------- coverage -------------------------------- */

/**
 * Places the archive actually covers well enough to browse.
 *
 * "Usable" follows AUDIT.md §B: a town/city-level location plus at least one
 * subject tag. State-level rows are excluded — "somewhere in Rajasthan" can't
 * anchor a browse experience. The audit measured 115 places clearing 20 usable
 * clips, and that set is what the landing page offers.
 *
 * City vs state is inferred from the gazetteer's own shape: state rows are
 * generated with name === district === state, so a row whose name equals its
 * state is a state, not a town.
 */
export function isTownLevel(place: Place): boolean {
  return place.name !== place.state;
}

export function getCoveredPlaces(minUsable = 20): { place: Place; clips: number }[] {
  const { places, clipsByPlace } = archive();

  return places
    .filter(isTownLevel)
    .map((place) => ({
      place,
      clips: (clipsByPlace.get(place.id) ?? []).filter((c) => c.subjects.length > 0).length,
    }))
    .filter((p) => p.clips >= minUsable)
    .sort((a, b) => b.clips - a.clips);
}

/**
 * True for footage shot in India, and for footage with no place at all
 * (wildlife and nature clips, which are legitimately unplaceable).
 *
 * The archive holds real footage shot abroad and we keep it — but it must not
 * *lead*. Unordered, the Railway subject page opened with an Amsterdam metro
 * and a Helsinki commuter train, which misreads the collection at a glance.
 */
export function isIndian(placeId: string | null): boolean {
  if (placeId === null) return true;
  return getPlace(placeId)?.country === 'India';
}

/**
 * Distant countries and cities, named in a title, on a clip the extractor never
 * managed to place.
 *
 * `isIndian(null)` returns true because an untagged clip is usually a close-up
 * of a bird or a flower with no place to give. But 21,566 clips carry no place,
 * and a few hundred of them are plainly abroad — so "winter" in a personalised
 * India feed returned a commuter train in Helsinki, and "spring" reached
 * Keukenhof in the Netherlands.
 *
 * Deliberately NOT built from the gazetteer's own non-India entries, which was
 * tried and was worse: it keys on nationality adjectives and flagged "Japanese
 * Flowering Quince" (grown here), "Kalimpong rafting with Nepali friends"
 * (Kalimpong is in Bengal) and the Dalai Lama at Tabo. Only place NOUNS, and
 * only far-away ones — Nepal, Bhutan, Sri Lanka, Bangladesh, Pakistan, Tibet
 * and Myanmar are missing on purpose, because the archive is India *and her
 * neighbours*. "Turkey" is missing for a different reason: Turkey tail is a
 * fungus, and it cost three woodland clips before the list was checked against
 * what it actually excluded. "Sydney" went the same way: Sydney Point is a
 * viewpoint at Panchgani in Maharashtra, and the gazetteer holds only 186
 * Indian places, so nothing was left to rescue it.
 */
const DISTANT_PLACE =
  /\b(?:Finland|Helsinki|Netherlands|Keukenhof|Holland|Sweden|Norway|Denmark|Germany|Berlin|France|Italy|Lombardy|Rome|Spain|Portugal|Switzerland|Austria|Salzburg|Vienna|Belgium|Poland|Greece|Istanbul|Ankara|Egypt|Kenya|Maasai\s+Mara|Serengeti|Tanzania|Morocco|Casablanca|Tokyo|Australia|Canada|Mauritius|Hollywood|California|Washington\s+DC|New\s+York|Brazil|Mexico|Russia|Moscow|Ural)\b/i;

/**
 * A title that also names India keeps the clip, because the footage is here and
 * the foreign word is the opponent, the visiting troupe or the origin story:
 * "India v/s Australia at Feroz Shah Kotla", "Otava Yo from Russia performing
 * at Sufi festival in India", "FIFA World Cup Russia sand art on beach in
 * India". Matched on word boundaries — substring matching rescued "World
 * championship of athletics in Spain" off some place name buried inside another
 * word.
 */
const INDIA_SIGNAL =
  /\b(?:india|indian|indians|india's|indo|indo-\w+|bharat|himalaya|himalayan|himalayas)\b/i;

let indianPlaceWords: RegExp | null = null;

/** True when a clip belongs in an India-facing feed. */
export function isIndianClip(clip: { placeId: string | null; title: string }): boolean {
  if (clip.placeId !== null) return isIndian(clip.placeId);

  if (!DISTANT_PLACE.test(clip.title)) return true;
  if (INDIA_SIGNAL.test(clip.title)) return true;

  // Built once: an Indian place named in the title settles it too, which is how
  // "View from Sydney Point, Panchgani" stays in.
  if (!indianPlaceWords) {
    const names = getPlaces()
      .filter((p) => p.country === 'India' && p.name.length >= 5)
      .map((p) => p.name.replace(/[^a-zA-Z\s]/g, '').trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    indianPlaceWords = new RegExp(`\\b(?:${names.join('|')})\\b`, 'i');
  }
  return indianPlaceWords.test(clip.title);
}

/**
 * Stable India-first ordering; relative order within each group is kept.
 *
 * Uses `isIndianClip`, not `isIndian`. Judging on the place tag alone treats
 * every untagged clip as Indian, so the `railway` subject page opened with a
 * Sahibabad Junction train and then "Winter train journey through Helsinki,
 * Finland on the HSL Commuter Railway" — second on the page. The feed already
 * read the title for this; the browse pages were still going by the tag.
 */
export function indiaFirst<T extends { placeId: string | null; title: string }>(
  clips: T[],
): T[] {
  const home: T[] = [];
  const away: T[] = [];
  for (const c of clips) (isIndianClip(c) ? home : away).push(c);
  return home.concat(away);
}

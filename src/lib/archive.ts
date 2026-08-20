import 'server-only';

import { readFileSync } from 'node:fs';
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
   * data/index.json is gitignored — it is 112 MB, past what a git repo should
   * carry and past GitHub's own 100 MB file limit. A fresh clone therefore has
   * no archive, and the raw ENOENT from readFileSync gives no clue why the
   * build died. Say what is missing and how to produce it.
   */
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new Error(
      `Missing data/${ARCHIVE_FILE}.\n\n` +
        `It is gitignored (112 MB), so a fresh clone or a CI checkout will not have it.\n` +
        `Restore it from a backup, or rebuild it:\n\n` +
        `  zstd -dc ~/Backups/clipahoy-archive/<date>/index.json.zst > data/${ARCHIVE_FILE}\n` +
        `  npm run ingest -- --offline   # re-extract from data/.ingest-cache.jsonl\n\n` +
        `See STATUS.md for how the archive is built and backed up.`,
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

/** Stable India-first ordering; relative order within each group is kept. */
export function indiaFirst<T extends { placeId: string | null }>(clips: T[]): T[] {
  const home: T[] = [];
  const away: T[] = [];
  for (const c of clips) (isIndian(c.placeId) ? home : away).push(c);
  return home.concat(away);
}

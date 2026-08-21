/**
 * Build a small, deployable slice of the archive.
 *
 *   npx tsx scripts/build-demo-index.ts [clipCount]
 *
 * The full index is 112 MB, takes 9.8s to load and leaves 961 MB on the heap —
 * past what any serverless platform will run, and past what git should carry.
 * A demo does not need all 108k clips: 25k with descriptions capped at 300
 * characters is 12.7 MB, which commits to a repo and boots in about a second.
 *
 * Selection is spread across places and subjects rather than taken off the top,
 * because the first N clips of the array are heavily skewed to whichever
 * playlists were crawled first — a demo built that way looks like an archive of
 * one city. Round-robin by place keeps the browse pages honest.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Clip, Place } from '../src/lib/types';

const TEXT_CAP = 300;
const target = Number(process.argv[2]) || 25_000;

const DATA = path.join(process.cwd(), 'data');
const full = JSON.parse(readFileSync(path.join(DATA, 'index.json'), 'utf8')) as {
  source: string;
  places: Place[];
  clips: Clip[];
};

// Only clips the product can actually surface well: a place AND a subject AND
// enough prose for a blurb. A demo should show the archive at its best.
const eligible = full.clips.filter(
  (c) => c.placeId && c.subjects.length > 0 && (c.text?.length ?? 0) > 120,
);

const byPlace = new Map<string, Clip[]>();
for (const clip of eligible) {
  const key = clip.placeId!;
  const bucket = byPlace.get(key);
  if (bucket) bucket.push(clip);
  else byPlace.set(key, [clip]);
}

const queues = [...byPlace.values()];
const picked: Clip[] = [];
for (let round = 0; picked.length < target; round++) {
  let addedThisRound = false;
  for (const queue of queues) {
    if (picked.length >= target) break;
    const clip = queue[round];
    if (clip) {
      picked.push({ ...clip, text: (clip.text ?? '').slice(0, TEXT_CAP) });
      addedThisRound = true;
    }
  }
  if (!addedThisRound) break;
}

const keptPlaces = new Set(picked.map((c) => c.placeId));
const out = {
  source: `${full.source} (demo slice: ${picked.length} of ${full.clips.length})`,
  places: full.places.filter((p) => keptPlaces.has(p.id)),
  clips: picked,
};

const file = path.join(DATA, 'index.demo.json');
writeFileSync(file, JSON.stringify(out));
const mb = (readFileSync(file).length / 1048576).toFixed(1);

console.log(`eligible clips   ${eligible.length.toLocaleString()} of ${full.clips.length.toLocaleString()}`);
console.log(`picked           ${picked.length.toLocaleString()} across ${keptPlaces.size} places`);
console.log(`subjects covered ${new Set(picked.flatMap((c) => c.subjects)).size} of 34`);
console.log(`wrote            data/index.demo.json  (${mb} MB)`);
console.log(`\nDeploy with:  ARCHIVE_FILE=index.demo.json`);

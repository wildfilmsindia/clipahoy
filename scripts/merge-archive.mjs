/**
 * Merge a freshly ingested delta into the existing archive.
 *
 *   node scripts/merge-archive.mjs <baseline.json.gz>
 *
 * Why this exists: `ingest.ts --since` rebuilds data/index.json from the crawl
 * cache alone. In CI the cache is a stub carrying video ids and nothing else
 * (the real 400 MB cache cannot live in the repo), so the extractor skips every
 * existing clip — it needs a title — and writes ONLY the handful of new videos.
 * Committing that replaces a 108k-clip archive with a few dozen rows.
 *
 * So the sync writes a delta, and this merges it back onto the baseline: the
 * archive as it stood before the run, read straight from the committed .gz.
 *
 * Clips and places are keyed by id, with the newly ingested row winning on a
 * collision — a re-ingested video should pick up its corrected title or tags.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [baselineGz] = process.argv.slice(2);
if (!baselineGz) {
  console.error('usage: node scripts/merge-archive.mjs <baseline.json.gz>');
  process.exit(1);
}

const baseline = JSON.parse(gunzipSync(readFileSync(baselineGz)).toString('utf8'));
const delta = JSON.parse(readFileSync('data/index.json', 'utf8'));

const clips = new Map(baseline.clips.map((c) => [c.id, c]));
const places = new Map(baseline.places.map((p) => [p.id, p]));

let added = 0;
let updated = 0;
for (const clip of delta.clips) {
  if (clips.has(clip.id)) updated++;
  else added++;
  clips.set(clip.id, clip);
}
for (const place of delta.places) places.set(place.id, place);

const merged = {
  source: delta.source,
  places: [...places.values()],
  clips: [...clips.values()],
};

// Same shape ingest.ts writes, so a CI-merged archive and a locally ingested
// one are byte-comparable rather than differing only in whitespace.
writeFileSync('data/index.json', JSON.stringify(merged, null, 2));

console.log(
  `merged: ${baseline.clips.length.toLocaleString()} baseline ` +
    `+ ${added.toLocaleString()} new (${updated.toLocaleString()} updated) ` +
    `= ${merged.clips.length.toLocaleString()} clips · ` +
    `${merged.places.length.toLocaleString()} places`,
);

if (merged.clips.length < baseline.clips.length) {
  console.error('ERROR: merge lost clips. Refusing to continue.');
  process.exit(1);
}

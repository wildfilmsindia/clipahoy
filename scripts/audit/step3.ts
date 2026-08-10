/**
 * Step 3: precision audit of the location-extraction cascade.
 *
 * Sample 100 clips from the MATCHED population (index.json, 59,388 clips),
 * seed=42. This is a different array than Step 0's noPlace sample (which
 * also used seed=42) — same seed, different population, documented per the
 * brief's reproducibility rule. This step is about PRECISION (is what we
 * extracted correct); RECALL was already characterised in Step 0 via the
 * noPlace bucket breakdown.
 *
 * For each sampled clip: which zone of the cascade produced the placeId
 * (recovered by re-running extractPlace with each zone selectively
 * disabled, to find which single zone would have produced the same
 * decision at the same priority), and a hand judgment of correctness.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { splitZones, extractPlace } from '../lib/extract';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sampleIndices(n: number, poolSize: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const chosen = new Set<number>();
  while (chosen.size < n) chosen.add(Math.floor(rand() * poolSize));
  return [...chosen].sort((a, b) => a - b);
}

const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const clips: { id: string; title: string; text: string; placeId: string }[] = index.clips;
const placeById = new Map(index.places.map((p: any) => [p.id, p]));

const indices = sampleIndices(100, clips.length, 42);
const sample = indices.map((i) => ({ index: i, ...clips[i] }));

// Recover which zone drove the decision by finding this clip's cache row
// (title + description) and re-running extraction zone-by-zone in the same
// priority order the production cascade uses: hashtag > title > prose.
// Playlist title isn't recoverable from index.json alone (not stored on the
// clip) — cross-referenced from the raw cache below.
import { createReadStream } from 'node:fs';
import readline from 'node:readline';

async function findCacheRows(ids: Set<string>) {
  const found = new Map<string, { title: string; description: string; playlistTitle?: string }>();
  const rl = readline.createInterface({
    input: createReadStream('data/.ingest-cache.jsonl', 'utf8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (found.size === ids.size) break;
    let row: any;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const vid = row.snippet?.resourceId?.videoId;
    if (vid && ids.has(vid) && !found.has(vid)) {
      found.set(vid, {
        title: row.snippet.title,
        description: row.snippet.description ?? '',
        playlistTitle: row.playlistTitle,
      });
    }
  }
  return found;
}

async function main() {
  const gaz = JSON.parse(readFileSync('data/gazetteer.json', 'utf8'));
  const wantIds = new Set(sample.map((s) => s.id));
  const cacheRows = await findCacheRows(wantIds);

  const results = sample.map((clip) => {
    const raw = cacheRows.get(clip.id);
    const zones = splitZones(raw?.description ?? '');

    // Determine which single zone produced the extraction, by checking in
    // the same priority order as extractPlace: playlist > hashtag > title > prose.
    let zoneSource = 'unknown';
    if (raw?.playlistTitle) {
      const hit = extractPlace(raw.title, splitZones(''), gaz.places, gaz.aliases, raw.playlistTitle);
      if (hit && hit.placeId === clip.placeId && hit.source === 'playlist') zoneSource = 'playlist title';
    }
    if (zoneSource === 'unknown') {
      const hit = extractPlace(raw?.title ?? clip.title, zones, gaz.places, gaz.aliases);
      if (hit && hit.placeId === clip.placeId) zoneSource = hit.source; // hashtag | title | prose
    }

    const place = placeById.get(clip.placeId) as any;
    return {
      index: clip.index,
      id: clip.id,
      title: clip.title,
      extractedPlace: place ? place.name : clip.placeId,
      zone: zoneSource,
      rawTitle: raw?.title ?? '(not found in cache)',
      description: (raw?.description ?? '').slice(0, 300),
      playlistTitle: raw?.playlistTitle ?? null,
    };
  });

  writeFileSync('data/audit/step3-sample-raw.json', JSON.stringify(results, null, 2));

  console.log(`Sampled ${results.length} matched clips (seed=42).`);
  console.log('\nZone distribution:');
  const zoneCounts: Record<string, number> = {};
  for (const r of results) zoneCounts[r.zone] = (zoneCounts[r.zone] ?? 0) + 1;
  for (const [z, n] of Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${z}: ${n}`);
  }

  console.log('\n=== FULL SAMPLE FOR HAND AUDIT ===');
  results.forEach((r, i) => {
    console.log(`\n--- #${i + 1} (row ${r.index}) ---`);
    console.log(`extracted place: ${r.extractedPlace}  [zone: ${r.zone}]`);
    console.log(`playlist:        ${r.playlistTitle ?? '(none)'}`);
    console.log(`title:           ${r.rawTitle}`);
    console.log(`description:     ${r.description}`);
  });
}

main();

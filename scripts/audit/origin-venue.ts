/**
 * Item 3: quantify origin-vs-venue error.
 *
 * The suspected failure: the extracted place is a real place named in the
 * metadata, but it is where a person/dance/breed/film ORIGINATES, or a place
 * merely discussed, rather than where the camera was. Distinct from the prose
 * drift already fixed — these clips look correct to a checker who only asks
 * "is this place mentioned?" and only fail when you ask "was it shot there?".
 *
 * Fresh seed 307: disjoint from 42/43 (location, metadata), 71/89/137/211
 * (leakage). Sampled only from clips that HAVE a place, since a null place
 * cannot exhibit this error.
 */
import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import readline from 'node:readline';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sampleIndices(n: number, pool: number, seed: number) {
  const rand = mulberry32(seed);
  const s = new Set<number>();
  while (s.size < n) s.add(Math.floor(rand() * pool));
  return [...s].sort((a, b) => a - b);
}

const idx = JSON.parse(readFileSync('data/index.json', 'utf8'));
const placed = idx.clips.filter((c: any) => c.placeId);
const gaz = JSON.parse(readFileSync('data/gazetteer.json', 'utf8')).places;

const SEED = Number(process.argv[2] ?? 307);
const indices = sampleIndices(100, placed.length, SEED);
const sample = indices.map((i) => ({ i, ...placed[i] }));

async function main() {
  const want = new Set(sample.map((c) => c.id));
  const raw = new Map<string, { title: string; description: string; playlistTitle?: string }>();
  const rl = readline.createInterface({
    input: createReadStream('data/.ingest-cache.jsonl', 'utf8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim() || raw.size === want.size) continue;
    try {
      const r = JSON.parse(line);
      const v = r.snippet?.resourceId?.videoId;
      if (v && want.has(v) && !raw.has(v)) {
        raw.set(v, {
          title: r.snippet.title,
          description: r.snippet.description ?? '',
          playlistTitle: r.playlistTitle,
        });
      }
    } catch {}
  }

  const out = sample.map((c) => ({
    index: c.i,
    id: c.id,
    place: gaz[c.placeId]?.name ?? c.placeId,
    title: c.title,
    playlist: raw.get(c.id)?.playlistTitle ?? null,
    prose: (raw.get(c.id)?.description ?? '').split('\n')[0].slice(0, 240),
  }));
  writeFileSync('data/audit/origin-venue-sample.json', JSON.stringify(out, null, 2));

  console.log(`n=100, seed=${SEED}, from ${placed.length} clips WITH a place\n`);
  out.forEach((r, n) => {
    console.log(`${String(n + 1).padStart(3)}. [${r.place}]  ${r.title.slice(0, 96)}`);
    if (r.playlist) console.log(`      pl: ${r.playlist.slice(0, 80)}`);
    console.log(`      pr: ${r.prose.slice(0, 150)}`);
  });
}
main();

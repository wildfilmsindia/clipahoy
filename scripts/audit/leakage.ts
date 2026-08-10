/**
 * Entertainment-content leakage audit.
 *
 * Samples from what is CURRENTLY SEARCHABLE (index.json, i.e. post-reject) and
 * prints it for hand classification. Fresh seed — 71 — deliberately disjoint
 * from the 42/43 used by the location and metadata audits, so this is not
 * measuring a population any earlier tuning was fitted to.
 */
import { readFileSync, writeFileSync } from 'node:fs';

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
const clips = idx.clips;
const indices = sampleIndices(100, clips.length, Number(process.argv[2] ?? 71));
const sample = indices.map((i) => ({ index: i, ...clips[i] }));

writeFileSync('data/audit/leakage-sample.json', JSON.stringify(sample, null, 2));

console.log(`n=100, seed=${process.argv[2] ?? 71}, drawn from ${clips.length} searchable clips\n`);
sample.forEach((c, i) => {
  console.log(`${String(i + 1).padStart(3)}. ${c.title}`);
});

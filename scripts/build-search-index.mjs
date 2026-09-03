/**
 * Precompute the search index so cold starts do not tokenise 108k documents.
 *
 *   npm run pack-index
 *
 * Runs as part of `npm run build`, so a deploy always ships a current index.
 */
import { writeFileSync, statSync, readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const gzPath = 'data/index.json.gz';
const jsonPath = 'data/index.json';
if (existsSync(jsonPath)) {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
  console.log(`[prebuild] data/index.json exists: ${raw.clips.length} clips (${(statSync(jsonPath).size / 1048576).toFixed(1)} MB)`);
} else if (existsSync(gzPath)) {
  const raw = JSON.parse(gunzipSync(readFileSync(gzPath)).toString());
  console.log(`[prebuild] data/index.json.gz: ${raw.clips.length} clips (${(statSync(gzPath).size / 1048576).toFixed(1)} MB)`);
} else {
  console.error('[prebuild] ERROR: no archive file found!');
  process.exit(1);
}

const { buildIndexFromScratch, serialiseIndex } = await import('../src/lib/search.ts');

const t0 = Date.now();
const idx = buildIndexFromScratch();
writeFileSync('data/search-index.bin', serialiseIndex(idx));
console.log(
  `built in ${((Date.now() - t0) / 1000).toFixed(1)}s -> data/search-index.bin ` +
    `(${(statSync('data/search-index.bin').size / 1048576).toFixed(1)} MB)`,
);

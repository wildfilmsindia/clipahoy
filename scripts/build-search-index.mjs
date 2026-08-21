/**
 * Precompute the search index so cold starts do not tokenise 108k documents.
 *
 *   npm run pack-index
 *
 * Runs as part of `npm run build`, so a deploy always ships a current index.
 */
import { writeFileSync, statSync } from 'node:fs';
const { buildIndexFromScratch, serialiseIndex } = await import('../src/lib/search.ts');

const t0 = Date.now();
const idx = buildIndexFromScratch();
writeFileSync('data/search-index.bin', serialiseIndex(idx));
console.log(
  `built in ${((Date.now() - t0) / 1000).toFixed(1)}s -> data/search-index.bin ` +
    `(${(statSync('data/search-index.bin').size / 1048576).toFixed(1)} MB)`,
);

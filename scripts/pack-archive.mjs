/**
 * Compress data/index.json so the repo can carry its own archive.
 *
 * Raw it is 112 MB, past GitHub's 100 MB file limit. gzip reaches ~20 MB with
 * no loss; archive.ts prefers the plain file when present and falls back to
 * this, so local development after an ingest needs no extra step.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const src = 'data/index.json';
const out = `${src}.gz`;
const raw = readFileSync(src);
writeFileSync(out, gzipSync(raw, { level: 9 }));

const mb = (b) => (b / 1048576).toFixed(1);
console.log(`${src}  ${mb(statSync(src).size)} MB  ->  ${out}  ${mb(statSync(out).size)} MB`);

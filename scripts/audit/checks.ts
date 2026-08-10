/** Follow-up checks 1-3: fallback template, no-place clips, non-India clips. */
import { readFileSync } from 'node:fs';
import { describeClip, describeLocation } from '../../src/lib/describe';
import type { Clip, Place } from '../../src/lib/types';

const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const unmatched = JSON.parse(readFileSync('data/unmatched.json', 'utf8'));
const clips: Clip[] = index.clips;
const placeById = new Map<string, Place>(index.places.map((p: Place) => [p.id, p]));

/* --- 1. Which clips hit the fallback? Re-derive the isUsable() condition. --- */
function cleanApprox(t: string) {
  return t
    .replace(/\bSG\s*\d+\b/gi, ' ')
    .replace(/\bMPCL\b/gi, ' ')
    .replace(/\bDISC\s*\d+\b/gi, ' ')
    .replace(/\bwild\s?films\s?india\b/gi, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function thin(t: string) {
  const c = cleanApprox(t);
  if (c.length < 20) return true;
  if (c.split(/\s+/).filter((w) => w.length > 1).length < 4) return true;
  return !/[a-z]{3}/.test(c);
}

const fellBack = clips.filter((c) => thin(c.title));
console.log('=== 1. FALLBACK TEMPLATE ===');
console.log(`clips hitting the fallback: ${fellBack.length} of ${clips.length} (${((fellBack.length / clips.length) * 100).toFixed(2)}%)`);
console.log('\nexamples (original title -> rendered sentence):');
fellBack.slice(0, 12).forEach((c) => {
  const p = c.placeId ? c.placeId ? placeById.get(c.placeId) : undefined : undefined;
  console.log(`  raw:  "${c.title}"`);
  console.log(`  subj: [${(c.subjects ?? []).join(', ') || 'none'}]`);
  console.log(`  ->    "${describeClip(c, p)}"   loc: ${describeLocation(c, p) ?? '(none)'}`);
  console.log('');
});

/* --- 2. No-place clips: are they in the index at all? --- */
console.log('=== 2. NO-PLACE / SUBJECT-ONLY CLIPS ===');
const clipsWithoutPlace = clips.filter((c) => !c.placeId);
console.log(`clips in index with no placeId: ${clipsWithoutPlace.length}`);
console.log(`clips in unmatched.noPlace (EXCLUDED from index): ${unmatched.noPlace.length}`);

const wildlifeWords = /\b(tiger|leopard|elephant|macaque|langur|deer|barbet|kingfisher|owl|python|cobra)\b/i;
const wildlifeNoPlace = unmatched.noPlace.filter((r: any) => wildlifeWords.test(r.title));
console.log(`\nof those excluded, titles naming common wildlife: ${wildlifeNoPlace.length}`);
console.log('examples that CANNOT currently be found by search:');
wildlifeNoPlace.slice(0, 6).forEach((r: any) => console.log(`  - ${r.title}`));

const inIndexTiger = clips.filter((c) => /\btiger\b/i.test(c.title)).length;
const inIndexLeopard = clips.filter((c) => /\bleopard\b/i.test(c.title)).length;
console.log(`\nsearchable today (have a place): tiger ${inIndexTiger}, leopard ${inIndexLeopard}`);

/* --- 3. Non-India clips --- */
console.log('\n=== 3. NON-INDIA CLIPS ===');
const nonIndiaWords = /\b(kathmandu|nepal|bhutan|thimphu|paro|tibet|lhasa|everest|sri lanka|colombo|dhaka|bangladesh|kabul|masai|maasai|kenya|tanzania|bangkok|amsterdam)\b/i;
const nonIndiaInIndex = clips.filter((c) => nonIndiaWords.test(c.title));
const nonIndiaExcluded = unmatched.noPlace.filter((r: any) => nonIndiaWords.test(r.title));
console.log(`non-India-titled clips IN the index (searchable): ${nonIndiaInIndex.length}`);
console.log(`non-India-titled clips EXCLUDED (unsearchable):   ${nonIndiaExcluded.length}`);
console.log('\nexamples currently in the index (matched to an Indian place anyway):');
nonIndiaInIndex.slice(0, 5).forEach((c) => {
  const p = c.placeId ? c.placeId ? placeById.get(c.placeId) : undefined : undefined;
  console.log(`  - "${c.title.slice(0, 88)}"  -> place: ${p?.name}`);
});
console.log('\nexamples excluded entirely:');
nonIndiaExcluded.slice(0, 5).forEach((r: any) => console.log(`  - ${r.title.slice(0, 88)}`));

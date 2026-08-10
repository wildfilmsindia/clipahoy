/**
 * Which playlist titles already resolve to a place under the current
 * 149-place gazetteer, and — for the ones that don't — what capitalised
 * place-like candidates they contain.
 *
 * Playlist titles are short, curated labels (median a handful of words),
 * so unlike noPlace video titles this scan does NOT skip the first word —
 * a huge fraction of these titles are literally just a place name
 * ("Agra", "Ahmedabad", "Kila Raipur"), and skipping word zero would throw
 * away the strongest signal in the whole corpus.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { extractPlace, splitZones } from '../lib/extract';

const titles: string[] = JSON.parse(readFileSync('data/audit/playlist-titles.json', 'utf8'));
const gaz = JSON.parse(readFileSync('data/gazetteer.json', 'utf8'));
const gazetteer = gaz.places;
const aliases = gaz.aliases;

const emptyZones = splitZones('');

const resolved: { title: string; placeId: string }[] = [];
const unresolved: string[] = [];

for (const title of titles) {
  const hit = extractPlace(title, emptyZones, gazetteer, aliases);
  if (hit) resolved.push({ title, placeId: hit.placeId });
  else unresolved.push(title);
}

console.log(`total playlist titles:      ${titles.length}`);
console.log(`already resolve to a place: ${resolved.length}`);
console.log(`no current match:           ${unresolved.length}`);

writeFileSync('data/audit/playlist-resolved.json', JSON.stringify(resolved, null, 2));
writeFileSync('data/audit/playlist-unresolved.json', JSON.stringify(unresolved, null, 2));

console.log('\n=== ALL UNRESOLVED PLAYLIST TITLES (full list, for hand review) ===');
unresolved.forEach((t, i) => console.log(String(i + 1).padStart(4), t));

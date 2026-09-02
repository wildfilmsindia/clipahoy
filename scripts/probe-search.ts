/**
 * Search-bar probe.
 *
 * The answer probe covers the onboarding feed; this covers `/search` — the box
 * itself, its paging and its facets. Different surface, different failure modes:
 * a query arrives raw from a URL anyone can edit, and the page has to survive
 * whatever is in it.
 *
 *   npx tsx --conditions=react-server scripts/probe-search.ts
 */
import { search, getSubjectCounts } from '../src/lib/search';
import { SUBJECTS } from '../src/lib/types';

const PAGE_SIZE = 24;

/** Mirrors src/app/search/page.tsx so the probe tests what the page does. */
function pageFor(rawQ: string | undefined, rawPage?: string, subject?: string) {
  const query = (rawQ ?? '').trim().slice(0, 120);
  const requestedPage = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const all = query ? search(query, Number.MAX_SAFE_INTEGER) : [];
  const filtered = subject
    ? all.filter((h) => h.clip.subjects.includes(subject as never))
    : all;
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, lastPage);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { query, page, total, shown: shown.length, lastPage };
}

console.log('=== QUERY SHAPES ===');
const QUERIES: [string, string][] = [
  ['', 'empty'],
  ['   ', 'whitespace only'],
  ['the and of in at', 'stopwords only'],
  ['a', 'single letter'],
  ['!!!', 'punctuation only'],
  ['....---___', 'symbols only'],
  ['12345', 'digits'],
  ['"kolkata tram"', 'quoted phrase'],
  ["farmer's market", 'apostrophe'],
  ['tiger   -   forest', 'stray dashes'],
  ['TIGER', 'all caps'],
  ['  monsoon  ', 'padded'],
  ['monsoon monsoon monsoon monsoon', 'repetition'],
  ['<script>alert(1)</script>', 'script tag'],
  ['tiger OR elephant', 'boolean-ish'],
  ['tiger AND elephant', 'boolean-ish'],
  ['+tiger -elephant', 'prefix operators'],
  ['%20%20', 'encoded spaces'],
  ['बिरयानी', 'devanagari'],
  ['🐘🐅', 'emoji'],
  ['x'.repeat(200), '200 chars'],
  ['kolkata tram monsoon railway temple market festival wedding', '8 words'],
];
for (const [q, note] of QUERIES) {
  const r = pageFor(q);
  const label = JSON.stringify(q.length > 24 ? `${q.slice(0, 24)}…` : q);
  console.log(
    `${label.padEnd(30)} total ${String(r.total).padStart(6)}  shown ${String(r.shown).padStart(2)}  lastPage ${String(r.lastPage).padStart(4)}   (${note})`,
  );
}

console.log('\n=== PAGING ===');
for (const p of ['1', '2', '0', '-5', 'abc', '1e9', '999999', '1.5', 'Infinity', 'NaN']) {
  const r = pageFor('monsoon', p);
  const flag = r.shown === 0 && r.total > 0 ? '   <-- EMPTY GRID, results exist' : '';
  console.log(
    `page=${String(p).padEnd(10)} -> page ${String(r.page).padEnd(8)} shown ${String(r.shown).padStart(2)} of ${r.total} (last ${r.lastPage})${flag}`,
  );
}

console.log('\n=== SUBJECT FACET ===');
for (const s of ['birds', 'not-a-subject', '', 'BIRDS', '../etc/passwd']) {
  const r = pageFor('monsoon', '1', s || undefined);
  console.log(`subject=${JSON.stringify(s).padEnd(18)} total ${String(r.total).padStart(6)}  shown ${r.shown}`);
}
console.log('valid subjects:', SUBJECTS.length, '| with clips:', getSubjectCounts().length);

console.log('\n=== RELEVANCE: does the top hit answer the query? ===');
const REAL: [string, RegExp][] = [
  ['taj mahal', /taj\s*mahal/i],
  ['varanasi ghats', /varanasi|banaras|ghat/i],
  ['holi festival colours', /holi/i],
  ['tea garden darjeeling', /tea|darjeeling/i],
  ['camel desert rajasthan', /camel|desert|thar|rajasthan|jaisalmer/i],
  ['auto rickshaw traffic', /rickshaw|auto|traffic/i],
  ['sadhu at kumbh mela', /sadhu|kumbh|naga|ascetic/i],
  ['snow leopard', /snow\s*leopard/i],
  ['backwater houseboat', /backwater|houseboat|kettuvallam/i],
  ['spice market', /spice|masala|mandi|market/i],
  ['classical dance performance', /dance|bharatanatyam|kathak|odissi|kuchipudi/i],
  ['village well water', /well|water|village|handpump/i],
  ['train crossing bridge', /train|railway|bridge|viaduct/i],
  ['monkey temple', /monkey|langur|macaque|temple/i],
  ['fishing boat sea', /fish|boat|sea|coast|trawler/i],
  ['tribal dance northeast', /tribal|naga|mizo|khasi|adi|apatani|dance/i],
  ['old delhi lanes', /delhi|chandni|lane|gali|street/i],
  ['tiger safari jungle', /tiger|safari|jungle|reserve|national park/i],
];
let ok = 0;
for (const [q, want] of REAL) {
  const h = search(q, 5);
  const top = h[0];
  const hit = top ? want.test(`${top.clip.title} ${top.clip.text ?? ''}`) : false;
  if (hit) ok++;
  console.log(`${hit ? ' ok ' : 'MISS'} "${q}" -> ${top ? top.clip.title.slice(0, 66) : '(no results)'}`);
}
console.log(`top-hit relevance: ${ok}/${REAL.length}`);

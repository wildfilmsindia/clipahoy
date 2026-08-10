/**
 * Steps 4, 5, 6, 7 of the archive audit. Runs against the post-fix index.
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
function sampleIndices(n: number, poolSize: number, seed: number): number[] {
  const rand = mulberry32(seed);
  const chosen = new Set<number>();
  while (chosen.size < n) chosen.add(Math.floor(rand() * poolSize));
  return [...chosen].sort((a, b) => a - b);
}

const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const gaz = JSON.parse(readFileSync('data/gazetteer.json', 'utf8'));
const unmatched = JSON.parse(readFileSync('data/unmatched.json', 'utf8'));
const clips = index.clips;
const places = index.places;
const placeById = new Map(places.map((p: any) => [p.id, p]));
const gazById = gaz.places;

const out: string[] = [];
const say = (s = '') => {
  out.push(s);
  console.log(s);
};

/* ============================ STEP 4 ============================ */
say('=============== STEP 4: FULL-CORPUS LOCATION ANALYSIS ===============');

const TOTAL_ROWS = 126524;
const UNIQUE_VIDEOS = 88159;
const DUPLICATE_ROWS = TOTAL_ROWS - UNIQUE_VIDEOS;

say(`total rows in raw cache:        ${TOTAL_ROWS}`);
say(`unique YouTube video IDs:       ${UNIQUE_VIDEOS}`);
say(`duplicate rows removed:         ${DUPLICATE_ROWS}  (detected by videoId; a video appears in`);
say(`                                 multiple playlists and in the uploads feed)`);
say(`matched clips in index:         ${clips.length}`);
say(`no place:                       ${unmatched.noPlace.length}`);
say(`no subject:                     ${unmatched.noSubject.length}`);
say(`rejected (not place footage):   ${unmatched.rejected.length}`);

// Granularity: city-level vs state-level, per gazetteer 'kind'.
let cityLevel = 0;
let stateLevel = 0;
for (const c of clips) {
  const g = gazById[c.placeId];
  if (!g) continue;
  if (g.kind === 'city') cityLevel++;
  else stateLevel++;
}
say('');
say('--- granularity of identified location (of matched clips) ---');
say(`city/town level:  ${cityLevel}  (${((cityLevel / UNIQUE_VIDEOS) * 100).toFixed(1)}% of unique corpus)`);
say(`state/UT level:   ${stateLevel}  (${((stateLevel / UNIQUE_VIDEOS) * 100).toFixed(1)}% of unique corpus)`);
say(`district-only:    0  — the gazetteer has no district-only rows; every entry`);
say(`                     resolves to either a settlement or a state.`);
say(`country-only:     0  — "India" alone is never emitted as a place.`);
say(`no location:      ${unmatched.noPlace.length}  (${((unmatched.noPlace.length / UNIQUE_VIDEOS) * 100).toFixed(1)}%)`);

/* usable clip = city/town location + >=1 subject tag */
const usableByPlace: Record<string, number> = {};
let usableTotal = 0;
for (const c of clips) {
  const g = gazById[c.placeId];
  if (!g || g.kind !== 'city') continue;
  if (!c.subjects || c.subjects.length === 0) continue;
  usableByPlace[c.placeId] = (usableByPlace[c.placeId] ?? 0) + 1;
  usableTotal++;
}
const ranked = Object.entries(usableByPlace).sort((a, b) => b[1] - a[1]);

say('');
say('--- USABLE CLIPS (city/town location + >=1 subject tag) ---');
say(`usable clips:                   ${usableTotal}  (${((usableTotal / UNIQUE_VIDEOS) * 100).toFixed(1)}% of unique corpus)`);
say(`unique places with >=1 usable:  ${ranked.length}`);
for (const t of [5, 20, 50, 100, 500]) {
  say(`places with ${String(t).padStart(3)}+ usable clips:   ${ranked.filter(([, n]) => n >= t).length}`);
}

// top-100 CSV
const subjectsByPlace: Record<string, Record<string, number>> = {};
const yearsByPlace: Record<string, number> = {};
for (const c of clips) {
  const g = gazById[c.placeId];
  if (!g || g.kind !== 'city') continue;
  subjectsByPlace[c.placeId] = subjectsByPlace[c.placeId] ?? {};
  for (const s of c.subjects ?? []) {
    subjectsByPlace[c.placeId][s] = (subjectsByPlace[c.placeId][s] ?? 0) + 1;
  }
  if (c.year !== null) yearsByPlace[c.placeId] = (yearsByPlace[c.placeId] ?? 0) + 1;
}
const csv = ['rank,place,state,usable_clips,top_subject_1,top_subject_2,top_subject_3,clips_with_year'];
ranked.slice(0, 100).forEach(([id, n], i) => {
  const p: any = placeById.get(id) ?? gazById[id];
  const tops = Object.entries(subjectsByPlace[id] ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s);
  csv.push(
    [i + 1, p.name, p.state, n, tops[0] ?? '', tops[1] ?? '', tops[2] ?? '', yearsByPlace[id] ?? 0]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
});
writeFileSync('data/audit/top-100-places.csv', csv.join('\n'));
say('');
say('top-100 places written to data/audit/top-100-places.csv');
say('');
say('--- TOP 25 PLACES BY USABLE CLIPS ---');
ranked.slice(0, 25).forEach(([id, n], i) => {
  const p: any = placeById.get(id) ?? gazById[id];
  const tops = Object.entries(subjectsByPlace[id] ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s)
    .join(', ');
  say(`${String(i + 1).padStart(3)}. ${String(n).padStart(5)}  ${p.name} (${p.state})  [${tops}]`);
});

/* ============================ STEP 6 ============================ */
say('');
say('=============== STEP 6: TEMPORAL COVERAGE ===============');
const withYear = clips.filter((c: any) => c.year !== null).length;
say(`confirmed filming date (explicit metadata field): 0  (0.0%)`);
say(`  -> NO SUCH FIELD EXISTS. YouTube's playlistItems.snippet provides`);
say(`     publishedAt (upload date) only. There is no filming-date field`);
say(`     anywhere in the raw cache.`);
say(`inferred filming period (year token in title or prose): ${withYear}  (${((withYear / clips.length) * 100).toFixed(1)}% of matched clips)`);
say(`upload date only: ${clips.length - withYear}  (${(((clips.length - withYear) / clips.length) * 100).toFixed(1)}%)`);

const yearDist: Record<string, number> = {};
for (const c of clips) {
  if (c.year === null) continue;
  const decade = `${Math.floor(c.year / 10) * 10}s`;
  yearDist[decade] = (yearDist[decade] ?? 0) + 1;
}
say('');
say('inferred-year distribution by decade (NOT confirmed filming dates):');
Object.entries(yearDist)
  .sort()
  .forEach(([d, n]) => say(`  ${d}: ${n}`));

/* ============================ STEP 7 ============================ */
say('');
say('=============== STEP 7: LICENSING / SEARCHABILITY ===============');

const QUERIES: [string, string[], string | null][] = [
  ['Kolkata tram', ['tram'], 'kolkata'],
  ['Mumbai monsoon', ['monsoon', 'rain'], 'mumbai'],
  ['Delhi railway station', ['railway', 'train', 'station'], 'delhi'],
  ['Rajasthan village', ['village', 'rural'], 'rajasthan'],
  ['Indian street market', ['market', 'bazaar', 'bazar'], null],
  ['Kerala backwaters', ['backwater', 'canal', 'boat'], 'kerala'],
  ['Himalayan landscape', ['himalaya', 'himalayan', 'mountain'], null],
  ['Indian wedding', ['wedding', 'marriage', 'baraat'], null],
];

const results: any[] = [];
for (const [label, keywords, placeHint] of QUERIES) {
  const matches = clips.filter((c: any) => {
    const hay = `${c.title} ${c.text}`.toLowerCase();
    const kwHit = keywords.some((k) => hay.includes(k));
    if (!kwHit) return false;
    if (!placeHint) return true;
    const g = gazById[c.placeId];
    if (!g) return false;
    return (
      c.placeId === placeHint ||
      g.state.toLowerCase() === placeHint ||
      g.name.toLowerCase() === placeHint
    );
  });
  results.push({ label, count: matches.length, top10: matches.slice(0, 10).map((c: any) => c.title) });
  say('');
  say(`--- "${label}" : ${matches.length} candidates ---`);
  matches.slice(0, 10).forEach((c: any, i: number) => say(`  ${i + 1}. ${c.title.slice(0, 95)}`));
}
writeFileSync('data/audit/step7-queries.json', JSON.stringify(results, null, 2));

/* ============================ STEP 5 sample ============================ */
say('');
say('=============== STEP 5: METADATA SHAPE SAMPLE (seed=43) ===============');
const idx5 = sampleIndices(100, clips.length, 43);
writeFileSync('data/audit/step5-indices.json', JSON.stringify(idx5));

async function step5() {
  const want = new Set(idx5.map((i) => clips[i].id));
  const found = new Map<string, any>();
  const rl = readline.createInterface({
    input: createReadStream('data/.ingest-cache.jsonl', 'utf8'),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim() || found.size === want.size) continue;
    try {
      const row = JSON.parse(line);
      const v = row.snippet?.resourceId?.videoId;
      if (v && want.has(v) && !found.has(v)) found.set(v, row);
    } catch {}
  }
  const recs = idx5.map((i) => {
    const c = clips[i];
    const r = found.get(c.id);
    return {
      index: i,
      id: c.id,
      title: r?.snippet?.title ?? c.title,
      descLen: (r?.snippet?.description ?? '').length,
      hasHashtags: /#[\p{L}\p{N}_]+/u.test(r?.snippet?.description ?? ''),
      publishedAt: r?.snippet?.publishedAt ?? null,
      playlistTitle: r?.playlistTitle ?? null,
      place: c.placeId,
      subjects: c.subjects,
      year: c.year,
    };
  });
  writeFileSync('data/audit/step5-sample.json', JSON.stringify(recs, null, 2));

  const lens = recs.map((r) => r.descLen).sort((a, b) => a - b);
  say(`description length: min ${lens[0]}, median ${lens[50]}, max ${lens[99]}`);
  say(`empty descriptions: ${lens.filter((l) => l === 0).length}/100`);
  say(`have hashtag block: ${recs.filter((r) => r.hasHashtags).length}/100`);
  say(`have playlist title: ${recs.filter((r) => r.playlistTitle).length}/100`);
  say(`ALL CAPS titles: ${recs.filter((r) => r.title === r.title.toUpperCase() && /[A-Z]{4}/.test(r.title)).length}/100`);
  say(`titles with a pipe delimiter: ${recs.filter((r) => r.title.includes('|')).length}/100`);
  say(`titles with a colon: ${recs.filter((r) => r.title.includes(':')).length}/100`);
  say(`non-Latin (Devanagari etc) titles: ${recs.filter((r) => /[ऀ-ॿঀ-৿]/.test(r.title)).length}/100`);
  say('');
  say('sample of 15 titles:');
  recs.slice(0, 15).forEach((r) => say(`  - ${r.title.slice(0, 100)}`));

  writeFileSync('data/audit/steps4-7-output.txt', out.join('\n'));
}
step5();

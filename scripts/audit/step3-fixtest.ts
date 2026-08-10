/**
 * Step 3 remediation: test two structural fixes for prose-zone overreach
 * against the SAME 100 records (seed=42).
 *
 *   Option (a) "confirm only": prose may never originate a location. Only
 *              title / hashtag / playlist can. Implemented by calling the
 *              production extractPlace() with prose blanked.
 *   Option (b) "first 2 sentences": prose is truncated to its first two
 *              sentences before extraction, on the theory that the real
 *              subject is stated up front and biographical/contextual drift
 *              comes later.
 *
 * Ground truth for all 100 records is hand-encoded below (GROUND_TRUTH),
 * derived from reading each title+description in the previous pass. For the
 * 78 originally-correct records the truth is what was extracted; for the 22
 * errors it is what the text actually supports, or null where the text
 * supports no specific gazetteer place at all.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { splitZones, extractPlace } from '../lib/extract';

const gaz = JSON.parse(readFileSync('data/gazetteer.json', 'utf8'));
const raw = JSON.parse(readFileSync('data/audit/step3-sample-raw.json', 'utf8'));

/**
 * placeId the text actually supports. null = text supports no specific
 * gazetteer place (so ANY extraction is a false positive, and returning
 * nothing is the correct behaviour).
 */
const GROUND_TRUTH: Record<number, string | null> = {
  3: 'uttarakhand', 13: 'karnataka', 23: null, 27: 'madhya pradesh',
  28: 'delhi', 42: 'punjab', 46: null, 51: 'bengaluru', 53: 'rajasthan',
  54: 'delhi', 56: 'nagaland', 57: 'tamil nadu', 60: 'delhi', 63: null,
  66: 'uttarakhand', 70: 'delhi', 76: 'jaisalmer', 78: 'tamil nadu',
  90: null, 92: 'delhi', 93: 'jammu and kashmir', 94: 'delhi',
};

/** Split prose into sentences, keeping it simple and language-agnostic. */
function firstSentences(prose: string, n: number): string {
  const parts = prose.split(/(?<=[.!?])\s+/);
  return parts.slice(0, n).join(' ');
}

type Row = {
  n: number;
  place: string;
  zone: string;
  truth: string | null | undefined;
  origVerdict: 'CORRECT' | 'ERROR';
  optA: string | null;
  optB: string | null;
};

const placeName = (id: string | null) =>
  id === null ? '(none)' : (gaz.places[id]?.name ?? id);

const rows: Row[] = raw.map((r: any, i: number) => {
  const n = i + 1;
  const zones = splitZones(r.description ?? '');
  const title = r.rawTitle ?? '';
  const playlist = r.playlistTitle ?? undefined;

  // Option (a): blank the prose entirely.
  const zonesNoProse = { ...zones, prose: '' };
  const a = extractPlace(title, zonesNoProse, gaz.places, gaz.aliases, playlist);

  // Option (b): prose truncated to first 2 sentences.
  const zonesShort = { ...zones, prose: firstSentences(zones.prose, 2) };
  const b = extractPlace(title, zonesShort, gaz.places, gaz.aliases, playlist);

  const origVerdict = GROUND_TRUTH[n] !== undefined ? 'ERROR' : 'CORRECT';
  const truth = GROUND_TRUTH[n] !== undefined ? GROUND_TRUTH[n] : r.extractedPlace;

  return {
    n,
    place: r.extractedPlace,
    zone: r.zone,
    truth,
    origVerdict,
    optA: a ? a.placeId : null,
    optB: b ? b.placeId : null,
  };
});

/* --- 1. recall cost of option (a): correct prose matches, corroborated? --- */

const correctProse = rows.filter((r) => r.zone === 'prose' && r.origVerdict === 'CORRECT');
const corroborated = correctProse.filter((r) => r.optA !== null);
const proseOnly = correctProse.filter((r) => r.optA === null);

console.log('=== 1. OPTION (a) RECALL COST ON CORRECT PROSE MATCHES ===');
console.log(`correct prose-zone matches:        ${correctProse.length}`);
console.log(`  corroborated by another zone:    ${corroborated.length}`);
console.log(`  prose-only (would be LOST):      ${proseOnly.length}`);
console.log('\nprose-only records that would lose their location:');
proseOnly.forEach((r) => console.log(`  #${r.n}  ${r.place}`));

/* ----------------- 2 & 3. evaluate both options end-to-end ---------------- */

function evaluate(key: 'optA' | 'optB', label: string) {
  let correct = 0;
  let wrong = 0;
  let none = 0;
  const fixedErrors: number[] = [];
  const lostCorrect: number[] = [];
  const stillWrong: number[] = [];

  for (const r of rows) {
    const got = r[key];
    // Normalise: truth may be a display name (for originally-correct rows).
    const truthId =
      r.origVerdict === 'CORRECT'
        ? Object.keys(gaz.places).find((k) => gaz.places[k].name === r.truth) ?? r.truth
        : r.truth;

    if (got === null) {
      none++;
      if (r.origVerdict === 'CORRECT') lostCorrect.push(r.n);
      else if (truthId === null) fixedErrors.push(r.n); // correctly returns nothing
      else fixedErrors.push(r.n); // no longer asserts a wrong place
    } else if (got === truthId) {
      correct++;
      if (r.origVerdict === 'ERROR') fixedErrors.push(r.n);
    } else {
      wrong++;
      if (r.origVerdict === 'ERROR') stillWrong.push(r.n);
      else lostCorrect.push(r.n);
    }
  }

  const withLocation = correct + wrong;
  const precision = withLocation > 0 ? (correct / withLocation) * 100 : 0;

  console.log(`\n=== ${label} ===`);
  console.log(`returns a location:   ${withLocation}/100`);
  console.log(`  correct:            ${correct}`);
  console.log(`  wrong:              ${wrong}`);
  console.log(`returns nothing:      ${none}`);
  console.log(`PRECISION (of those returning a location): ${precision.toFixed(1)}%`);
  console.log(`errors fixed:         ${fixedErrors.length} of 22`);
  console.log(`previously-correct records that lost their location: ${lostCorrect.length}`);
  console.log(`errors still wrong:   ${stillWrong.length}  -> #${stillWrong.join(', #')}`);

  return { precision, correct, wrong, none, lostCorrect, stillWrong, fixedErrors };
}

const A = evaluate('optA', '2. OPTION (a): prose confirms only, never originates');
const B = evaluate('optB', '3. OPTION (b): prose truncated to first 2 sentences');

/* ------------- 3b. spot-check option (b) on the named failures ------------ */

console.log('\n=== 3b. OPTION (b) SPOT-CHECK ON NAMED FAILURES ===');
for (const n of [27, 23]) {
  const r = rows.find((x) => x.n === n)!;
  const label = n === 27 ? 'Chambal river' : 'Namvar Singh / Banaras Hindu University';
  console.log(
    `#${n} ${label}\n  original: ${r.place}  |  truth: ${placeName(
      (r.truth as string) ?? null,
    )}  |  opt(b) gives: ${placeName(r.optB)}  ${
      r.optB === r.truth ? '-> FIXED' : '-> NOT FIXED'
    }`,
  );
}

/* ---------------- 4. same-name collisions: neither fix touches ------------- */

console.log('\n=== 4. SAME-NAME COLLISIONS (structural, untouched by either fix) ===');
for (const n of [90, 66]) {
  const r = rows.find((x) => x.n === n)!;
  const label = n === 90 ? 'Puri (place) vs Om Puri (person)' : 'Srinagar J&K vs Srinagar Garhwal';
  console.log(
    `#${n} ${label}\n  original: ${r.place} | opt(a): ${placeName(r.optA)} | opt(b): ${placeName(
      r.optB,
    )}`,
  );
}

writeFileSync(
  'data/audit/step3-fixtest.json',
  JSON.stringify({ rows, optionA: A, optionB: B }, null, 2),
);

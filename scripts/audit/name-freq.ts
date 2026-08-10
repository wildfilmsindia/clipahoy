/**
 * Step 0, pass 1: frequency-count capitalised-word tokens across the FULL
 * noPlace[] pool (29,259 titles) to derive a person-name candidate list.
 *
 * Judgment call, documented here because the brief didn't specify: the
 * 3+ occurrence threshold is applied against the full noPlace pool, not
 * the 500-record sample. A 500-record sample of 29,259 titles will show
 * almost every name exactly once or zero times, so "3+ times" would never
 * fire and bucket 1 (reject) would collapse into bucket 4 (ambiguous) for
 * spurious reasons unrelated to whether the content is actually reject-worthy.
 * Counting against the full pool makes the threshold mean something; the
 * 500-record sample is still what gets classified and published as the audit.
 *
 * Two independent candidate lists come out of this:
 *   - bigrams: adjacent Capitalised-Word pairs not at title-start (catches
 *     "Amitabh Bachchan", "Shah Rukh", "Priyanka Chopra")
 *   - unigrams: single Capitalised words not at title-start, not a bigram
 *     member, not a common English/species word (catches single-name
 *     mentions and mid-title proper nouns generally — some of these will
 *     turn out to be places, not people, and get manually reviewed before
 *     being added to either list)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const unmatched = JSON.parse(readFileSync('data/unmatched.json', 'utf8'));
const noPlace: { id: string; title: string }[] = unmatched.noPlace;

const gazetteer = JSON.parse(readFileSync('data/gazetteer.json', 'utf8'));
const gazetteerNames = new Set<string>();
for (const p of Object.values(gazetteer.places) as { name: string }[]) {
  gazetteerNames.add(p.name.toLowerCase());
}
for (const alias of Object.keys(gazetteer.aliases)) gazetteerNames.add(alias.toLowerCase());

// Common English words that happen to get capitalised mid-title (species
// names, generic nouns used as proper-style titles, days/months, etc).
// This list is deliberately conservative — it only excludes tokens that are
// unambiguously not personal or place names, so it doesn't hide real
// candidates.
const COMMON = new Set([
  'the','a','an','and','or','of','in','on','at','to','for','with','is','are',
  'was','were','india','indian','video','private','deleted','black','white',
  'grey','green','blue','red','yellow','brown','common','national','park',
  'part','week','world','life','army','women','men','man','woman','boy','girl',
  'baby','wild','wildlife','forest','forests','mountain','mountains','river',
  'lake','bird','birds','tree','trees','flower','flowers','tiger','leopard',
  'elephant','monkey','macaque','deer','snake','insect','butterfly','festival',
  'temple','market','street','road','city','town','village','morning','evening',
  'night','day','summer','winter','monsoon','rain','season','close','full','new',
  'old','young','large','small','group','people','close-up','shot','view','scene',
  'from','near','over','under','into','out','off','up','down','after','before',
  'while','during','across','along','through','their','they','this','that','it',
  'its','be','been','as','by','his','her','not','no','all','some','more','most',
  'other','one','two','three','four','five','india\'s','asia','asia\'s','south',
  'north','east','west','central','union','republic','independence','day',
  'january','february','march','april','may','june','july','august','september',
  'october','november','december','monday','tuesday','wednesday','thursday',
  'friday','saturday','sunday','wearing','holding','standing','sitting','walking',
  'running','flying','eating','drinking','playing','looking','watching','using',
]);

function words(title: string): string[] {
  return title.split(/\s+/).map((w) => w.replace(/[^A-Za-z']/g, ''));
}

function isCapWord(w: string): boolean {
  return w.length >= 3 && /^[A-Z][a-z']+$/.test(w) && !COMMON.has(w.toLowerCase());
}

const bigramCounts = new Map<string, number>();
const unigramCounts = new Map<string, number>();

for (const { title } of noPlace) {
  const ws = words(title);
  // Skip index 0: title-case first word is capitalised regardless of whether
  // it's a proper noun, so it carries no signal on its own.
  for (let i = 1; i < ws.length; i++) {
    const w = ws[i];
    if (!isCapWord(w)) continue;

    if (i + 1 < ws.length && isCapWord(ws[i + 1])) {
      const bg = `${w} ${ws[i + 1]}`;
      const key = bg.toLowerCase();
      if (!gazetteerNames.has(key)) {
        bigramCounts.set(bg, (bigramCounts.get(bg) ?? 0) + 1);
      }
    }

    const key = w.toLowerCase();
    if (!gazetteerNames.has(key)) {
      unigramCounts.set(w, (unigramCounts.get(w) ?? 0) + 1);
    }
  }
}

const bigrams = [...bigramCounts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
const unigrams = [...unigramCounts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);

writeFileSync(
  'data/audit/name-freq-bigrams.json',
  JSON.stringify(bigrams.map(([term, count]) => ({ term, count })), null, 2),
);
writeFileSync(
  'data/audit/name-freq-unigrams.json',
  JSON.stringify(unigrams.map(([term, count]) => ({ term, count })), null, 2),
);

console.log(`noPlace pool: ${noPlace.length} titles`);
console.log(`bigrams with count>=3: ${bigrams.length}`);
console.log(`unigrams with count>=3: ${unigrams.length}`);
console.log('\ntop 40 bigrams:');
bigrams.slice(0, 40).forEach(([t, n]) => console.log(`  ${n}\t${t}`));
console.log('\ntop 60 unigrams:');
unigrams.slice(0, 60).forEach(([t, n]) => console.log(`  ${n}\t${t}`));

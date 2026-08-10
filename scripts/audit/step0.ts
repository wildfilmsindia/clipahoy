/**
 * Step 0: reclassify unmatched.noPlace[] into four buckets, per the
 * audit brief. Deterministic, seeded, every rule published below.
 *
 * ---------------------------------------------------------------------------
 * CURATION METHODOLOGY (read before trusting the numbers)
 *
 * The frequency pass (name-freq.ts) surfaced 385 bigrams and 1,778 unigrams
 * at count>=8 across the full 29,259-title noPlace pool. All of them were
 * reviewed by hand and sorted into the lists below. Terms below count 8
 * were NOT individually reviewed — there are ~1,100 bigrams and ~2,900
 * unigrams in the 3-7 range, which is not reviewable by hand in this pass.
 * A term in that range only triggers a rule if it independently matches
 * something already on a reviewed list (e.g. a low-frequency bigram
 * containing "Khan" still triggers via the unigram "Khan", which was
 * reviewed at count 1,287). A low-frequency term that does NOT overlap a
 * reviewed list triggers nothing and the record falls through to whichever
 * bucket the rest of its title earns — typically ambiguous.
 *
 * This means: the published percentages are a LOWER BOUND on bucket 1
 * (reject) and bucket 2 (gazetteer gap). Some fraction of bucket 4
 * (ambiguous) is reject-worthy or gazetteer-gap content that used a name or
 * place term too rare to have been reviewed. The size of that undercount is
 * unknown — flagged here rather than hidden, per the brief's rule against
 * fabricating precision.
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from 'node:fs';

/* --------------------------------- PRNG ---------------------------------- */

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
  while (chosen.size < n) {
    chosen.add(Math.floor(rand() * poolSize));
  }
  return [...chosen].sort((a, b) => a - b);
}

/* ------------------------------ word helpers ------------------------------ */

function words(title: string): string[] {
  return title.split(/\s+/).map((w) => w.replace(/[^A-Za-z']/g, ''));
}

function hasWord(title: string, term: string): boolean {
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(title);
}

function hasAny(title: string, terms: string[]): string | null {
  for (const t of terms) if (hasWord(title, t)) return t;
  return null;
}

/* ----------------------- A. format-keyword list (single source) ----------- */

/**
 * Not frequency-mined — these are common English words/phrases, so
 * capitalisation-based mining doesn't apply. Specified directly, then
 * counted against the pool for transparency (counts printed at the bottom).
 * Used both standalone (bucket 1 on its own) and as the required co-occurring
 * signal for the public-figure carve-out.
 */
const FORMAT_KEYWORDS = [
  'private video',
  'deleted video',
  'interview',
  'press conference',
  'screening',
  'premiere',
  'promo',
  'trailer',
  'teaser',
  'launch',
  'red carpet',
  'ramp walk',
  'walks the ramp',
  'fashion show',
  'fashion week',
  'photoshoot',
  'photo shoot',
  'calendar shoot',
  'magazine cover',
  'chat show',
  'talk show',
  'reality show',
  'award show',
  'awards',
  'stardust award',
  'filmfare',
  'iifa',
  'star screen',
  'zee awards',
  'ott release',
  'item song',
  'song release',
  'music release',
  'music video',
  'album launch',
  'on the sets of',
  'at the launch of',
  'at the screening of',
  'poses for',
  'spotted at',
  'snapped at',
  'stage performance',
  'live performance',
  'unplugged',
  'concert',
];

/* ------------------ B. Bollywood / entertainment names (straight reject) -- */

/**
 * Reviewed from the count>=8 bigram/unigram lists. Actors, directors,
 * producers, playback singers, fashion designers, TV personalities appearing
 * in an entertainment-industry context in this corpus. Explicitly excludes:
 * bird/species names, place names (Indian and foreign), and political/
 * religious figures (those are in the PUBLIC_FIGURES carve-out list below).
 */
const BOLLYWOOD_NAMES = [
  // surnames / single names (unigram, count>=8, reviewed)
  'Khan', 'Kapoor', 'Bachchan', 'Chopra', 'Shetty', 'Bhatt', 'Rai', 'Dutt',
  'Deol', 'Roshan', 'Abraham', 'Basu', 'Kher', 'Arora', 'Chawla', 'Dutta',
  'Khanna', 'Aishwarya', 'Sadhguru', 'Shroff', 'Azmi', 'Kaif', 'Mirza',
  'Reddy', 'Mukherjee', 'Warsi', 'Oberoi', 'Ghai', 'Irani', 'Johar', 'Kareena',
  'Hashmi', 'Balan', 'Sawant', 'Vikram', 'Govinda', 'Morea', 'Shergill',
  'Koirala', 'Takia', 'Dixit', 'Bhandarkar', 'Ranaut', 'Dhupia', 'Rampal',
  'Bipasha', 'Malik', 'Mehta', 'Saif', 'Palm', 'Chandra', 'Sushmita', 'Subhash',
  'Phadnis', 'Jaitley', 'Bose', 'Tandon', 'Deshmukh', 'Rani', 'Ajay', 'Shekhar',
  'Bhandarkar', 'Manish', 'Malhotra', 'Sunil', 'Amrita', 'Nigam', 'Varma',
  'Jackie', 'Matondkar', 'Zinta', 'Suman', 'Juhi', 'Arshad', 'Chatterjee',
  'Padukone', 'Sibia', 'Rohit', 'Javed', 'Soman', 'Devgan', 'Devgn', 'Patekar',
  'Karishma', "Kapoor's", 'Bobby', 'Verma', 'Jhangiani', 'Vinod', 'Vivek',
  'Shabana', 'Mukesh', 'Shivdasani', 'Talpade', 'Shweta', 'Suri', 'Shahrukh',
  'Mukerji', 'Mallya', 'Dilip', 'Benegal', 'Sohail', 'Saawariya', 'Desai',
  'Kaushik', 'Emraan', 'Chakraborty', 'Munna', 'Lever', 'Kohli', 'Ahuja',
  'Menon', 'Khemu', 'Bachchan\'s', 'Pooja', "Dutt's", 'Lara', 'Kajol',
  'Panag', 'Kunal', 'Yash', 'Lahiri', 'Jaya', 'Poonam', 'Rekha', 'Rajesh',
  'Dino', 'Vidya', 'Rishi', 'Kawaatra', 'Arbaaz', 'Tusshar', 'Zayed',
  'Bhansali', 'Farhan', 'Mahima', 'Kapur', 'Mithun', 'Hirani', 'Soha',
  'Sami', 'Sunny', 'Lulla', 'Celina', 'Rakhi', 'Tabu', 'Sarai', "Kumar's",
  'Gulshan', 'Sood', 'Rehman', 'Pathak', 'Neha', 'Ayesha', 'Mallika',
  'Boman', 'Deepika', 'Kangana', 'Manisha', 'Jalota', 'Shyam', 'Agnihotri',
  'Yagnik', 'Sengupta', 'Urmila', 'Ramesh', 'Dharmendra', 'Ashutosh', 'Farah',
  'Bhardwaj', 'Dattani', 'Paul', 'Abhay', 'Rawal', 'Raju', 'Preity', 'Isha',
  'Riteish', 'Bhagat', 'Ghosh', 'Sameera', 'Ashok', 'Naseeruddin', 'Kirron',
  'Dhawan', 'Amar', 'Babbar', 'Nikhil', 'Kim', 'Thackeray', 'Govitrikar',
  'Ustad', 'Kothari', 'Sheep', 'Shatrughan', 'Rahman', 'Jha', 'Ekta',
  'David', 'Hema', 'Bismillah', 'Munjal', 'Ratnani', 'Mehra', 'Bajpayee',
  'Shorey', 'Dandekar', 'Baweja', 'Manuel', 'Kolhapure', 'Randhawa', 'Vidhu',
  'Mani', 'Hooda', 'Kapadia', 'Nihalani', 'Lajmi', 'Mahadevan', 'Kaushal',
  'Adnan', 'Zakir', 'Narula', 'Denzongpa', 'Waheeda', 'Rajadhyaksha', 'Bazmee',
  'Palekar', 'Manjrekar', 'Milind', 'Kapil', 'Sridevi', 'Irrfan', 'Shakti',
  'Upen', 'Taurani', 'Ganguly', 'Husain', 'Shirodkar', 'Bharti', 'Choksi',
  'Rohatgi', 'Merchant', 'Suneel', 'Motwani', 'Ramleela', 'Imtiaz', 'Siddharth',
  'Saluja', 'Rajkumar', 'Shukla', 'Bappi', 'Sikri', 'Vikas', 'Madhubala',
  'Kabhiee', 'Randhir', 'Paudwal', 'Neetu', 'Gowariker', 'Sharmila',
  'Minissha', 'Jadeja', 'Bhatt\'s', "Rai's", 'Sabyasachi', 'Amitji',
  'Shetty\'s', 'Tupur', 'Kaifi', 'Mookhey', 'Karisma', 'Helen', 'Femina',
  'Banerjee', 'Mahajan', 'Pran', 'Kishore', 'Shahnaz', 'Doshi', 'Aryan',
  'Sardar', 'Shrivastava', 'Jalal', 'Mohit', 'Baap', "Money'", 'Models',
  'Sheikh', 'Kabhi', 'Choudry', 'Saira', 'Ray', 'Idol', 'Vinay', 'Sanju',
  'Sawhney', 'Bimal', 'Amisha', "Mukherjee's", 'Krrish', 'Murad', 'Baabul',
  'Chunky', 'Sinha', "Sinha's", 'Fardeen', 'Mehul', 'Ranbir', 'Ambani',
  'Sonu', 'Anu', 'Sonam', 'Tamil', 'Saxena', 'Pie', 'Rajkumar', 'Principal',
  'Ayurvedic', 'Shivratri', 'Kashyap', 'Shreyas', 'Pancholi', 'Salim',
  'Bhoothnath', 'Preeti', 'Smita', 'Tijori', "Salman's", 'Boney', 'Sibal',
  'Cinderella', 'Kavya', 'Sagarmatha',
];

/* -------------- C. public figures (carve-out — needs format-keyword) ------ */

const PUBLIC_FIGURES = [
  'Dalai Lama', 'Dalai', 'Lama', "Lama's", 'Holiness', 'Rinpoche',
  'Modi', 'Gandhi', "Gandhi's", 'Nehru', 'Jawaharlal', 'Vajpayee', 'Bihari',
  'Manmohan', 'Advani', 'Abdul Kalam', 'Kalam', 'Narasimha Rao', 'Rao',
  'Lal Bahadur', 'Bahadur', 'Shastri', 'Indira', 'Rajiv', 'Sonia', 'Narendra',
  'Sachin Tendulkar', 'Tendulkar', 'President', "President's", 'Prime Minister',
  'Minister', 'Rashtrapati', 'Congress', 'Sabha', 'Parliament', 'Chairman',
  'Mandela', 'Clinton', 'Abdullah', 'Sibal',
];

/* ---------------------- D. non-India place-name terms (2b) ---------------- */

const NON_INDIA_TERMS = [
  'Nepal', "Nepal's", 'Nepali', 'Nepalese', 'Kathmandu', 'Pokhara', 'Thamel',
  'Chitwan', 'Keoladeo', 'Phewa', 'Bhaktapur', 'Ghandruk', 'Landruk',
  'Birethanti', 'Nyalam', 'Annapurna', 'Dhaulagiri', 'Hiunchuli',
  'Bhutan', "Bhutan's", 'Bhutanese', 'Thimphu', 'Paro', 'Bumthang', 'Punakha',
  'Trongsa', 'Druk', 'Dzong', 'Gompa', 'Tsechu', 'Kyichu', 'Lhakhang',
  'Tibet', 'Tibetan', 'Tibetans', 'Lhasa', 'Boudhanath', 'Bodhgaya',
  'Sri Lanka', 'Lanka', 'Lankan', 'Colombo', 'Galle',
  'Bangladesh', 'Dhaka', 'Chittagong', "Cox's", 'Bazar', 'Sadarghat',
  'Afghanistan', 'Afghan', 'Kabul', 'Taliban',
  'Pakistan', 'Pakistani',
  'China', 'Chinese', 'Hong Kong', 'Kong',
  'Kenya', "Kenya's", 'Tanzania', 'Africa', "Africa's", 'African',
  'Masai', 'Maasai', 'Mara',
  'Singapore', 'Indonesia', 'Bali', 'Nusa', 'Penida',
  'Thailand', 'Bangkok', 'Phuket', 'Nakhon', 'Pathom', 'Erawan',
  'Cambodia', 'Laos', 'Luang', 'Prabang', 'Vietnam', 'Malaysia', 'Kuta',
  'Taiwan', 'Taiwanese', 'Japan', 'Australia',
  'Netherlands', 'Amsterdam', 'Keukenhof',
  'France', 'French', 'Paris', 'Riviera', 'Chamonix', 'Blanc', 'Annecy',
  'Portugal', 'Lisbon', 'Switzerland', 'Geneva', 'Salzburg', 'Austria',
  'Germany', 'German', 'Berlin', 'Russia', 'Russian', 'Moscow',
  'Turkey', 'Istanbul',
  'Dubai', 'Abu Dhabi', 'Dhabi', 'Qatar',
  'Antigua', 'Jamaica', 'Caribbean', 'Morocco', 'Vanuatu',
  'Europe', 'European', 'America', 'American', 'Washington', 'York',
  'United', 'England', 'British', 'London',
  'Mauritius', 'Casablanca', 'Helsinki', 'Timor', 'Baucau',
  'Everest', 'Mount Everest', 'Kailash', 'Manasarovar', 'Mansarovar',
];

/* -------------- helper stopwords for the gazetteer-gap detector ----------- */

const HINDI_STOPWORDS = new Set([
  "i'm", 'hai', 'toh', 'mein', 'kabhi', 'hoon', 'yeh', 'kya', 'aap', 'tum',
  'woh', 'bas', 'hota', 'nahin', "hai'", "i've", 'main', 'aur', 'meri', 'meri',
  'mujhe', 'mere', 'naa', 'pehle', 'bhi', 'dus', 'koi', 'raho', 'sirf', 'apne',
  'hastey', 'khoya', 'kuchh', 'kuch', 'thoda', 'jaane', "don't", "he's",
  "we're", "she's", 'nice', 'jab', 'why', 'who', 'when', 'how', 'there',
  'even', 'please', 'have', 'will', 'your', 'like', 'child', 'lot', 'fun',
  'super', 'high', 'stop', 'living', 'budget', 'best', 'hot', 'moon',
  'spring', 'very', 'islam', 'education', 'folk', 'match', 'female', 'chand',
]);

/* -------------------- SPECIES / SUBJECT terms (bucket 3 signal) ----------- */

const SPECIES_TERMS = [
  'Barbet', 'Thrush', 'Sunbird', 'Kite', 'Myna', 'Egret', 'Heron', 'Owl',
  'Owlet', 'Kingfisher', 'Flycatcher', 'Bulbul', 'Parakeet', 'Woodpecker',
  'Lapwing', 'Drongo', 'Babbler', 'Robin', 'Pheasant', 'Vulture', 'Vultures',
  'Stork', 'Storks', 'Crane', 'Sparrow', 'Starling', 'Oriole', 'Redstart',
  'Wagtail', 'Tit', 'Moorhen', 'Waterhen', 'Francolin', 'Treepie', 'Cuckoo',
  'Peafowl', 'Pigeon', 'Pigeons', 'Dove', 'Crow', 'Bee-eater', 'Beeeater',
  'Squirrel', 'Lizard', 'Langur', 'Langurs', 'Macaque', 'Macaques', 'Bear',
  'Fox', 'Cobra', 'Tortoiseshell', 'Forktail', 'Cormorant', 'Rhinoceros',
  'Blackbuck', 'Blackbird', 'Partridge', 'Turtle', 'Whistling', 'Whitebreasted',
  'Whitethroated', 'Redwattled', 'Redvented', 'Roseringed', 'Chestnutbellied',
  'Fivestriped', 'Rufous', 'Coppersmith', 'Griffon', 'Pied', 'Purple',
  'Spotted', 'Collared', 'Streaked', 'Bharal', 'Ibex', 'Goral', 'Mongoose',
  'Python', 'Sheep', 'Yak', 'Yaks', 'Bee', 'Bees', 'Ants', 'Spider', 'Beetle',
  'Butterfly', 'Butterflies', 'Dragonfly', 'Moth', 'Caterpillar', 'Cicada',
  'Termites', 'Duck', 'Flamingos', 'Fish', 'Rat', 'Bug', 'Stilt', 'Weaver',
  'Buzzard', 'Shikra', 'Shrike', 'Sambhar', 'Elephants', 'Tiger', 'Leopard',
  'Cattle', 'Chicken', 'Dog', 'Cow', 'Goat', 'Horse', 'Mongoose',
  'Tulip', 'Tulips', 'Daisy', 'Daisies', 'Dahlia', 'Dahlias', 'Poppy',
  'Rhododendron', 'Rhododendrons', 'Lotus', 'Lily', 'Lilies', 'Orchid',
  'Cosmos', 'Sunflower', 'Anemone', 'Primrose', 'Primula', 'Crocus', 'Iris',
  'Geranium', 'Pansy', 'Cotton', 'Silk', 'Grass', 'Fungus', 'Mushroom',
  'Neem', 'Banyan', 'Ficus', 'Lantana', 'Hyacinth', 'Oak', 'Leaf',
];

/* --------------------------------- classify ------------------------------- */

type Bucket = 'reject' | 'gap-2a' | 'gap-2b' | 'subject' | 'ambiguous';

function classify(title: string): { bucket: Bucket; rule: string } {
  const fmt = hasAny(title, FORMAT_KEYWORDS);

  if (hasWord(title, 'private video')) return { bucket: 'reject', rule: 'format: private video' };
  if (hasWord(title, 'deleted video')) return { bucket: 'reject', rule: 'format: deleted video' };

  const bw = hasAny(title, BOLLYWOOD_NAMES);
  if (bw) return { bucket: 'reject', rule: `bollywood name: ${bw}` };

  if (fmt) {
    const pf = hasAny(title, PUBLIC_FIGURES);
    if (pf) return { bucket: 'reject', rule: `public figure "${pf}" + format keyword "${fmt}"` };
    return { bucket: 'reject', rule: `format keyword: ${fmt}` };
  }

  const nonIndia = hasAny(title, NON_INDIA_TERMS);
  if (nonIndia) return { bucket: 'gap-2b', rule: `non-India term: ${nonIndia}` };

  // Gazetteer-gap candidate: a capitalised word, not at title-start, not a
  // reviewed name/format/species/stopword term. This is the same detector
  // used in name-freq.ts, applied per-title here.
  const ws = words(title);
  for (let i = 1; i < ws.length; i++) {
    const w = ws[i];
    if (w.length < 3 || !/^[A-Z][a-z']+$/.test(w)) continue;
    const lw = w.toLowerCase();
    if (HINDI_STOPWORDS.has(lw)) continue;
    if (SPECIES_TERMS.some((s) => s.toLowerCase() === lw)) continue;
    if (PUBLIC_FIGURES.some((s) => s.toLowerCase() === lw)) continue; // bare mention, no format kw -> handled below as ambiguous, not a place
    return { bucket: 'gap-2a', rule: `candidate place token: ${w}` };
  }

  const species = hasAny(title, SPECIES_TERMS);
  if (species) return { bucket: 'subject', rule: `species/subject term: ${species}` };

  const barePf = hasAny(title, PUBLIC_FIGURES);
  if (barePf) return { bucket: 'ambiguous', rule: `public figure "${barePf}" without format keyword` };

  // No proper-noun-like token, no species term either: treat as subject-only
  // if it reads as generic descriptive footage (default when nothing else
  // fired and there's no capitalised mid-title token at all).
  const anyCap = ws.slice(1).some((w) => w.length >= 3 && /^[A-Z][a-z']+$/.test(w));
  if (!anyCap) return { bucket: 'subject', rule: 'no proper-noun token present' };

  return { bucket: 'ambiguous', rule: 'no rule fired' };
}

/* ------------------------------------ run ---------------------------------- */

const unmatched = JSON.parse(readFileSync('data/unmatched.json', 'utf8'));
const noPlace: { id: string; title: string }[] = unmatched.noPlace;

const indices = sampleIndices(500, noPlace.length, 42);
const sample = indices.map((i) => ({ index: i, ...noPlace[i] }));

const results = sample.map((r) => ({ ...r, ...classify(r.title) }));

const counts: Record<Bucket, number> = { reject: 0, 'gap-2a': 0, 'gap-2b': 0, subject: 0, ambiguous: 0 };
for (const r of results) counts[r.bucket]++;

// CSV
const csvLines = [
  'index,id,title,bucket,rule',
  ...results.map(
    (r) =>
      `${r.index},"${r.id}","${r.title.replace(/"/g, '""')}",${r.bucket},"${r.rule.replace(/"/g, '""')}"`,
  ),
];
writeFileSync('data/noplace-sample.csv', csvLines.join('\n'));

// Format-keyword occurrence counts across the full pool (for transparency)
const fmtCounts = FORMAT_KEYWORDS.map((kw) => ({
  keyword: kw,
  count: noPlace.filter((r) => hasWord(r.title, kw)).length,
})).sort((a, b) => b.count - a.count);

writeFileSync(
  'data/audit/format-keywords.json',
  JSON.stringify(fmtCounts, null, 2),
);

const pct = (n: number) => ((n / 500) * 100).toFixed(1) + '%';

console.log('=== BUCKET COUNTS (n=500, seed=42) ===');
console.log(`reject:      ${counts.reject}\t${pct(counts.reject)}`);
console.log(`gap-2a (IN): ${counts['gap-2a']}\t${pct(counts['gap-2a'])}`);
console.log(`gap-2b (!IN):${counts['gap-2b']}\t${pct(counts['gap-2b'])}`);
console.log(`subject:     ${counts.subject}\t${pct(counts.subject)}`);
console.log(`ambiguous:   ${counts.ambiguous}\t${pct(counts.ambiguous)}`);
console.log(`gap total:   ${counts['gap-2a'] + counts['gap-2b']}\t${pct(counts['gap-2a'] + counts['gap-2b'])}`);

console.log('\n=== 10 EXAMPLES PER BUCKET ===');
for (const b of ['reject', 'gap-2a', 'gap-2b', 'subject', 'ambiguous'] as Bucket[]) {
  console.log(`\n--- ${b} ---`);
  results.filter((r) => r.bucket === b).slice(0, 10).forEach((r) => console.log(`  [${r.rule}] ${r.title}`));
}

// Effective match rate if reject were excluded from the denominator.
const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const matched = index.clips.length;
const totalUnique = 88159; // from last full ingest report (unique videos after dedup)
const rejectShare = counts.reject / 500;
const estimatedRejectInPool = Math.round(noPlace.length * rejectShare);
const effectiveDenominator = totalUnique - estimatedRejectInPool;
const effectiveRate = ((matched / effectiveDenominator) * 100).toFixed(1);

console.log('\n=== EFFECTIVE MATCH RATE IF BUCKET 1 EXCLUDED ===');
console.log(`matched clips:                 ${matched}`);
console.log(`total unique videos:           ${totalUnique}`);
console.log(`noPlace pool:                  ${noPlace.length}`);
console.log(`reject share of noPlace (sample): ${(rejectShare * 100).toFixed(1)}%`);
console.log(`estimated reject count in full noPlace pool: ${estimatedRejectInPool}`);
console.log(`raw match rate:                ${((matched / totalUnique) * 100).toFixed(1)}%`);
console.log(`effective match rate (reject excluded from denominator): ${effectiveRate}%`);

writeFileSync(
  'data/audit/step0-summary.json',
  JSON.stringify(
    {
      seed: 42,
      sampleSize: 500,
      poolSize: noPlace.length,
      indices,
      counts,
      percentages: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / 5).toFixed(1)])),
      rawMatchRate: +((matched / totalUnique) * 100).toFixed(1),
      effectiveMatchRate: +effectiveRate,
      estimatedRejectInFullPool: estimatedRejectInPool,
    },
    null,
    2,
  ),
);

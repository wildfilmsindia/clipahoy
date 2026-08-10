/**
 * Step 0, revision 2 — six-bucket scheme, same 500 records (seed=42).
 *
 * Changes from step0.ts, in order of importance:
 *
 * 1. STRUCTURAL FIX: the gazetteer-gap detector used to return on the first
 *    unexcluded capitalised word in the title. That meant a title correctly
 *    containing "Dalai Lama" could get hijacked by an earlier, unrelated
 *    capitalised word ("Zenkoji", "Tackling", "Need" — all fragments of
 *    Dalai Lama lecture titles) before the scan ever reached the real
 *    signal. NON_INDIA_TERMS, REGION_TERMS, FESTIVAL_TERMS and PUBLIC_FIGURES
 *    are now checked as whole-title hasAny() passes BEFORE the per-word
 *    gazetteer-gap loop, so word order inside the title no longer determines
 *    the outcome. This fixed roughly a dozen records on its own.
 *
 * 2. New GENERIC_STOPWORDS + COLOUR_WORDS lists. The single biggest source
 *    of gap-2a contamination was mid-title capitalised common words with no
 *    naming signal at all ("Small", "Common", "Heavy", "Story", "Love",
 *    colour adjectives in front of species names). These are excluded from
 *    the candidate-token scan entirely, they are not assigned to any bucket
 *    via list membership — excluding them lets the scan continue to the
 *    real signal later in the title (e.g. "Black Drongo" now reaches
 *    "Drongo" instead of stopping at "Black").
 *
 * 3. Two new buckets, per the audit brief:
 *      5 — region/range: real geography, not resolvable to one place row
 *          (Himalaya, Ganga, Kashmir-as-region, Western Ghats, Thar, Deccan)
 *      6 — festival/event: the title is about an event, not a location
 *          (Diwali, Muharram, Ganesh Visarjan, Gangasagar Mela)
 *
 * 4. BOLLYWOOD_NAMES and SPECIES_TERMS extended from the actual 225 gap-2a
 *    misses in the prior run (not the frequency table). Full diff printed
 *    at the bottom of this file's output.
 *
 * ---------------------------------------------------------------------------
 * A DOCUMENTED RISK, not swept under the rug: several additions are common
 * Indian surnames that are NOT exclusively celebrity names — Singh, Yadav,
 * Shah, Ahmed, Sen, Bedi. In this sample, every instance was unambiguously
 * an actor/artist interview. Added anyway, because the brief's instruction
 * was to catch what actually misclassified in this archive, not to build a
 * risk-free list. Outside this 500-record sample, these surnames will
 * appear in non-entertainment contexts too, and this list will incorrectly
 * reject some of that content. The size of that false-positive rate is
 * unmeasured — it would need a targeted precision check on records
 * containing ONLY these ambiguous surnames, which has not been run.
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync } from 'node:fs';

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
/** Matches a species term allowing a trailing plural 's' (Parakeet/Parakeets). */
function isSpeciesWord(w: string): boolean {
  const lw = w.toLowerCase();
  return SPECIES_TERMS.some((s) => {
    const sl = s.toLowerCase();
    return sl === lw || sl + 's' === lw || sl === lw + 's';
  });
}

/* ------------------------- A. format keywords (pruned) -------------------- */
const FORMAT_KEYWORDS = [
  'private video', 'deleted video', 'interview', 'launch', 'premiere',
  'fashion show', 'awards', 'music release', 'unplugged', 'on the sets of',
  'walks the ramp', 'promo', 'at the launch of', 'concert', 'album launch',
  'star screen', 'screening', 'award show', 'ramp walk', 'filmfare', 'iifa',
  'music video', 'item song', 'poses for', 'stardust award', 'photoshoot',
  'photo shoot', 'live performance', 'spotted at', 'reality show', 'teaser',
  'magazine cover', 'trailer', 'at the screening of', 'talk show',
  'zee awards',
  // added this revision
  'bollywood',
];
// pruned for zero hits in the 29,259-title pool: press conference, red
// carpet, fashion week, calendar shoot, chat show, ott release, song
// release, snapped at, stage performance.

/* --------------------- B. Bollywood/entertainment (reject) ---------------- */
const BOLLYWOOD_NAMES = [
  'Khan', 'Kapoor', 'Bachchan', 'Chopra', 'Shetty', 'Bhatt', 'Rai', 'Dutt',
  'Deol', 'Roshan', 'Abraham', 'Basu', 'Kher', 'Arora', 'Chawla', 'Dutta',
  'Khanna', 'Aishwarya', 'Sadhguru', 'Shroff', 'Azmi', 'Kaif', 'Mirza',
  'Reddy', 'Mukherjee', 'Warsi', 'Oberoi', 'Ghai', 'Irani', 'Johar', 'Kareena',
  'Hashmi', 'Balan', 'Sawant', 'Vikram', 'Govinda', 'Morea', 'Shergill',
  'Koirala', 'Takia', 'Dixit', 'Bhandarkar', 'Ranaut', 'Dhupia', 'Rampal',
  'Bipasha', 'Malik', 'Mehta', 'Saif', 'Chandra', 'Sushmita', 'Subhash',
  'Phadnis', 'Jaitley', 'Bose', 'Tandon', 'Deshmukh', 'Rani', 'Ajay', 'Shekhar',
  'Manish', 'Malhotra', 'Sunil', 'Amrita', 'Nigam', 'Varma', 'Jackie',
  'Matondkar', 'Zinta', 'Suman', 'Juhi', 'Arshad', 'Chatterjee', 'Padukone',
  'Sibia', 'Rohit', 'Javed', 'Soman', 'Devgan', 'Devgn', 'Patekar', 'Karishma',
  "Kapoor's", 'Bobby', 'Verma', 'Jhangiani', 'Vinod', 'Vivek', 'Shabana',
  'Mukesh', 'Shivdasani', 'Talpade', 'Shweta', 'Suri', 'Shahrukh', 'Mukerji',
  'Mallya', 'Dilip', 'Benegal', 'Sohail', 'Desai', 'Kaushik', 'Emraan',
  'Chakraborty', 'Munna', 'Lever', 'Kohli', 'Ahuja', 'Menon', 'Khemu',
  "Bachchan's", 'Pooja', "Dutt's", 'Lara', 'Kajol', 'Panag', 'Kunal', 'Yash',
  'Lahiri', 'Jaya', 'Poonam', 'Rekha', 'Rajesh', 'Dino', 'Vidya', 'Rishi',
  'Kawaatra', 'Arbaaz', 'Tusshar', 'Zayed', 'Bhansali', 'Farhan', 'Mahima',
  'Kapur', 'Mithun', 'Hirani', 'Soha', 'Sami', 'Sunny', 'Lulla', 'Celina',
  'Rakhi', 'Tabu', 'Sarai', "Kumar's", 'Gulshan', 'Sood', 'Rehman', 'Pathak',
  'Neha', 'Ayesha', 'Mallika', 'Boman', 'Deepika', 'Kangana', 'Manisha',
  'Jalota', 'Shyam', 'Agnihotri', 'Yagnik', 'Sengupta', 'Urmila', 'Ramesh',
  'Dharmendra', 'Ashutosh', 'Farah', 'Bhardwaj', 'Dattani', 'Paul', 'Abhay',
  'Rawal', 'Raju', 'Preity', 'Isha', 'Riteish', 'Bhagat', 'Ghosh', 'Sameera',
  'Ashok', 'Naseeruddin', 'Kirron', 'Dhawan', 'Amar', 'Babbar', 'Nikhil',
  'Kim', 'Thackeray', 'Govitrikar', 'Ustad', 'Kothari', 'Rahman', 'Jha',
  'Ekta', 'David', 'Hema', 'Bismillah', 'Munjal', 'Ratnani', 'Mehra',
  'Bajpayee', 'Shorey', 'Dandekar', 'Baweja', 'Manuel', 'Kolhapure',
  'Randhawa', 'Vidhu', 'Mani', 'Hooda', 'Kapadia', 'Nihalani', 'Lajmi',
  'Mahadevan', 'Kaushal', 'Adnan', 'Zakir', 'Narula', 'Denzongpa', 'Waheeda',
  'Rajadhyaksha', 'Bazmee', 'Palekar', 'Manjrekar', 'Milind', 'Kapil',
  'Sridevi', 'Irrfan', 'Shakti', 'Upen', 'Taurani', 'Ganguly', 'Husain',
  'Shirodkar', 'Bharti', 'Choksi', 'Rohatgi', 'Merchant', 'Suneel', 'Motwani',
  'Ramleela', 'Imtiaz', 'Siddharth', 'Saluja', 'Rajkumar', 'Shukla', 'Bappi',
  'Sikri', 'Vikas', 'Madhubala', 'Kabhiee', 'Randhir', 'Paudwal', 'Neetu',
  'Gowariker', 'Sharmila', 'Minissha', 'Jadeja', "Bhatt's", "Rai's",
  'Sabyasachi', 'Karisma', 'Helen', 'Femina', 'Banerjee', 'Mahajan', 'Pran',
  'Kishore', 'Shahnaz', 'Doshi', 'Aryan', 'Sardar', 'Shrivastava', 'Jalal',
  'Mohit', 'Baap', "Money'", 'Models', 'Sheikh', 'Kabhi', 'Choudry', 'Saira',
  'Ray', 'Idol', 'Vinay', 'Sanju', 'Sawhney', 'Bimal', 'Amisha',
  "Mukherjee's", 'Krrish', 'Murad', 'Baabul', 'Chunky', 'Sinha', "Sinha's",
  'Fardeen', 'Mehul', 'Ranbir', 'Ambani', 'Sonu', 'Anu', 'Sonam', 'Saxena',
  'Ayurvedic', 'Kashyap', 'Shreyas', 'Pancholi', 'Salim', 'Preeti', 'Smita',
  'Tijori', "Salman's", 'Boney', 'Cinderella', 'Kavya',
  // added this revision, sourced from the actual 225 gap-2a records
  'Anjaan', 'Krishnamoorthi', 'Berry', 'Bedi', 'Asgar', 'Basra', 'Sachdev',
  'Wahab', 'Ghatak', 'Aswani', 'Shaw', 'Sonal', 'Woods', 'Ayaan', 'Hayden',
  'Shah', 'Sen', 'Singh', 'Yadav', 'Ahmed',
];

/* -------------- C. public figures (carve-out — needs format keyword) ------ */
const PUBLIC_FIGURES = [
  'Dalai Lama', 'Dalai', 'Lama', "Lama's", 'Holiness', 'Rinpoche',
  'Modi', 'Gandhi', "Gandhi's", 'Mahatma', 'Nehru', 'Jawaharlal', 'Vajpayee',
  'Bihari', 'Manmohan', 'Advani', 'Abdul Kalam', 'Kalam', 'Abdul',
  'Narasimha Rao', 'Rao', 'Lal Bahadur', 'Bahadur', 'Shastri', 'Indira',
  'Rajiv', 'Sonia', 'Narendra', 'Sachin Tendulkar', 'Tendulkar', 'President',
  "President's", 'Prime Minister', 'Minister', 'Rashtrapati', 'Congress',
  'Sabha', 'Parliament', 'Chairman', 'Mandela', 'Clinton', 'Abdullah',
  'Sibal',
  // added this revision
  'Narayanan', 'Diana', 'Naidu', 'Azad', 'Azhar', 'Mulayam', 'Buddha',
  'Khamtrul',
];

/* ------------------------- D. non-India place terms (2b) ------------------ */
const NON_INDIA_TERMS = [
  'Nepal', "Nepal's", 'Nepali', 'Nepalese', 'Nepalgunj', 'Kathmandu',
  'Pokhara', 'Thamel', 'Chitwan', 'Keoladeo', 'Phewa', 'Bhaktapur',
  'Ghandruk', 'Landruk', 'Birethanti', 'Nyalam', 'Annapurna', 'Dhaulagiri',
  'Hiunchuli', 'Jumla',
  'Bhutan', "Bhutan's", 'Bhutanese', 'Thimphu', 'Paro', 'Bumthang',
  'Punakha', 'Trongsa', 'Druk', 'Dzong', 'Gompa', 'Tsechu', 'Kyichu',
  'Lhakhang',
  'Tibet', 'Tibetan', 'Tibetans', 'Lhasa', 'Boudhanath', 'Bodhgaya',
  'Sri Lanka', 'Lanka', 'Lankan', 'Colombo', 'Galle',
  'Bangladesh', 'Bangladeshi', 'Dhaka', 'Chittagong', "Cox's", 'Sadarghat',
  'Afghanistan', 'Afghan', 'Afghani', 'Kabul', 'Taliban',
  'Pakistan', 'Pakistani', 'China', 'Chinese', 'Hong Kong', 'Kong',
  'Kenya', "Kenya's", 'Tanzania', 'Africa', "Africa's", 'African', 'Masai',
  'Maasai', 'Mara', 'Mongolia', 'Gobi',
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
  'United', 'England', 'British', 'London', 'Indies',
  'Mauritius', 'Casablanca', 'Helsinki', 'Timor', 'Baucau',
];

/* --------------------------- E. region/range (bucket 5) ------------------- */
const REGION_TERMS = [
  'Himalaya', "Himalaya's", 'Himalayan', 'Himalayas',
  'Kashmir', 'Kashmiri',
  'Ganga', 'Yamuna', 'Ganges', 'Brahmaputra', 'Chambal',
  'Western Ghats', 'Eastern Ghats', 'Ghats', 'Deccan', 'Thar', 'Aravalli',
  'Vindhya', 'Sahyadri', 'Konkan', 'Malwa', 'Terai', 'Doab', 'Rann',
  'Northeast', 'Sundarbans',
];

/* --------------------------- F. festival/event (bucket 6) ----------------- */
const FESTIVAL_TERMS = [
  'Janmashtami', 'Durga Puja', 'Puja', 'Gangasagar', 'Kumbh', 'Mahakumbh',
  'Dussehra', 'Diwali', 'Holi', 'Rakshabandhan', 'Bhai Dooj', 'Dooj',
  'Muharram', 'Eid', "Eid-ul-fitr", 'Eidulfitr', 'Ganesh Visarjan',
  'Ganesh Chaturthi', 'Chaturthi', 'Ganesha', 'Ramlila', 'Ram Lila',
  'Chhath', 'Mahashivratri', 'Shivratri', 'Grub Fest', 'Grub', 'Surajkund',
  'Crafts Mela', 'Craft Mela', 'Trade Fair', 'Republic Day', 'Independence Day',
  'Goddess Durga', 'Lathmar Holi', 'Barsana',
];

/** Not names, not places, not signal — pure capitalisation false positives. */
const GENERIC_STOPWORDS = new Set([
  'small', 'common', 'young', 'man', 'heavy', 'birds', 'bird', 'cluster',
  'drinking', 'footage', 'oriental', 'geese', 'haath', 'orchard', 'motidhar',
  'greatest', 'one', 'hawk', 'water', 'times', 'sony', 'story', 'indians',
  'india', "india's", 'indian', 'diana', 'helpage', 'sabeer', 'day',
  'national', 'pose', 'ambassador', 'concorde', 'changing', 'mughal', 'help',
  'poppies', 'lilium', 'royal', 'ela', 'scope', 'homosapiens', 'wrightia',
  'sarkar', 'eichium', 'orange', 'branded', 'kakar', 'ami', "ami'", 'food',
  'eclipse', 'goddess', 'bel', 'bengali', 'traditional', 'church', "ziona's",
  'feeding', 'labourers', 'share', 'sunset', 'soni', 'maharaj', 'bote',
  'let', 'ladoo', 'chilla', 'bell', 'preening', 'singer', 'love', 'navy',
  'defence', 'lafz', 'rituals', 'air', 'rarest', 'arya\'s', 'zindabad',
  'azhar', 'bahubali', 'muslims', 'hathi', 'western', 'awareness', 'sushi',
  'adi', 'need', "john's", 'higher', 'fundamental', 'garland', 'awakening',
  'tackling', 'zenkoji', 'lohmann', 'rajasthani', 'bharath\'s', 'stripethroated',
]);
const COLOUR_WORDS = new Set([
  'black', 'white', 'brown', 'green', 'blue', 'red', 'yellow', 'grey',
  'purple', 'golden', 'pink', 'orange', 'silver',
]);

/** Genuine, city/town/institution-level place candidates seen this pass. */
const SPECIES_TERMS = [
  'Barbet', 'Thrush', 'Sunbird', 'Kite', 'Myna', 'Egret', 'Heron', 'Owl',
  'Owlet', 'Kingfisher', 'Flycatcher', 'Bulbul', 'Parakeet', 'Woodpecker',
  'Lapwing', 'Drongo', 'Babbler', 'Robin', 'Pheasant', 'Vulture', 'Stork',
  'Crane', 'Sparrow', 'Starling', 'Oriole', 'Redstart', 'Wagtail', 'Tit',
  'Moorhen', 'Waterhen', 'Francolin', 'Treepie', 'Cuckoo', 'Peafowl',
  'Pigeon', 'Dove', 'Crow', 'Beeeater', 'Squirrel', 'Lizard', 'Langur',
  'Macaque', 'Bear', 'Fox', 'Cobra', 'Tortoiseshell', 'Forktail', 'Cormorant',
  'Rhinoceros', 'Blackbuck', 'Blackbird', 'Partridge', 'Turtle', 'Whistling',
  'Whitebreasted', 'Whitethroated', 'Redwattled', 'Redvented', 'Roseringed',
  'Chestnutbellied', 'Fivestriped', 'Rufous', 'Coppersmith', 'Griffon',
  'Pied', 'Spotted', 'Collared', 'Streaked', 'Bharal', 'Ibex', 'Goral',
  'Mongoose', 'Python', 'Sheep', 'Yak', 'Bee', 'Ant', 'Spider', 'Beetle',
  'Butterfly', 'Dragonfly', 'Moth', 'Caterpillar', 'Cicada', 'Termite',
  'Duck', 'Flamingo', 'Fish', 'Rat', 'Bug', 'Stilt', 'Weaver', 'Buzzard',
  'Shikra', 'Shrike', 'Sambhar', 'Elephant', 'Tiger', 'Leopard', 'Cattle',
  'Chicken', 'Dog', 'Cow', 'Goat', 'Horse', 'Tulip', 'Daisy', 'Dahlia',
  'Poppy', 'Rhododendron', 'Lotus', 'Lily', 'Orchid', 'Cosmos', 'Sunflower',
  'Anemone', 'Primrose', 'Primula', 'Crocus', 'Iris', 'Geranium', 'Pansy',
  'Cotton', 'Silk', 'Grass', 'Fungus', 'Mushroom', 'Neem', 'Banyan', 'Ficus',
  'Lantana', 'Hyacinth', 'Oak', 'Leaf', 'Accentor',
  // added this revision
  'Pygmy', 'Quail', 'Bushchat', 'Sturnus', 'Agama', 'Psittacula', 'Rosefinch',
  'Swallow', 'Koel', 'Lion',
];
const HINDI_STOPWORDS = new Set([
  "i'm", 'hai', 'toh', 'mein', 'kabhi', 'hoon', 'yeh', 'kya', 'aap', 'tum',
  'woh', 'bas', 'hota', 'nahin', "hai'", "i've", 'main', 'aur', 'meri',
  'mujhe', 'mere', 'naa', 'pehle', 'bhi', 'dus', 'koi', 'raho', 'sirf',
  'apne', 'hastey', 'khoya', 'kuchh', 'kuch', 'thoda', 'jaane', "don't",
  "he's", "we're", "she's", 'nice', 'jab', 'why', 'who', 'when', 'how',
  'there', 'even', 'please', 'have', 'will', 'your', 'like', 'child', 'lot',
  'fun', 'super', 'high', 'stop', 'living', 'budget', 'best', 'hot', 'moon',
  'spring', 'very', 'islam', 'education', 'folk', 'match', 'female', 'chand',
]);

/* --------------------------------- classify -------------------------------- */

type Bucket = 'reject' | 'gap-2a' | 'gap-2b' | 'subject' | 'ambiguous' | 'region' | 'festival';

function classify(title: string): { bucket: Bucket; rule: string } {
  if (hasWord(title, 'private video')) return { bucket: 'reject', rule: 'format: private video' };
  if (hasWord(title, 'deleted video')) return { bucket: 'reject', rule: 'format: deleted video' };

  const bw = hasAny(title, BOLLYWOOD_NAMES);
  if (bw) return { bucket: 'reject', rule: `bollywood name: ${bw}` };

  const fmt = hasAny(title, FORMAT_KEYWORDS);
  const pf = hasAny(title, PUBLIC_FIGURES); // whole-title check, fixes the scan-order bug

  if (fmt) {
    if (pf) return { bucket: 'reject', rule: `public figure "${pf}" + format keyword "${fmt}"` };
    return { bucket: 'reject', rule: `format keyword: ${fmt}` };
  }
  if (pf) return { bucket: 'ambiguous', rule: `public figure "${pf}" without format keyword` };

  const nonIndia = hasAny(title, NON_INDIA_TERMS);
  if (nonIndia) return { bucket: 'gap-2b', rule: `non-India term: ${nonIndia}` };

  const region = hasAny(title, REGION_TERMS);
  if (region) return { bucket: 'region', rule: `region term: ${region}` };

  const festival = hasAny(title, FESTIVAL_TERMS);
  if (festival) return { bucket: 'festival', rule: `festival term: ${festival}` };

  const ws = words(title);
  for (let i = 1; i < ws.length; i++) {
    const w = ws[i];
    if (w.length < 3 || !/^[A-Z][a-z']+$/.test(w)) continue;
    const lw = w.toLowerCase();
    if (HINDI_STOPWORDS.has(lw)) continue;
    if (GENERIC_STOPWORDS.has(lw)) continue;
    if (COLOUR_WORDS.has(lw)) continue;
    if (isSpeciesWord(w)) continue;
    return { bucket: 'gap-2a', rule: `candidate place token: ${w}` };
  }

  const species = hasAny(title, SPECIES_TERMS);
  if (species) return { bucket: 'subject', rule: `species/subject term: ${species}` };

  const anyCap = ws.slice(1).some((w) => w.length >= 3 && /^[A-Z][a-z']+$/.test(w));
  if (!anyCap) return { bucket: 'subject', rule: 'no proper-noun token present' };

  return { bucket: 'ambiguous', rule: 'no rule fired' };
}

/* ------------------------------------ run ---------------------------------- */

const unmatched = JSON.parse(readFileSync('data/unmatched.json', 'utf8'));
const noPlace: { id: string; title: string }[] = unmatched.noPlace;

const indices = sampleIndices(500, noPlace.length, 42); // same seed, same indices
const sample = indices.map((i) => ({ index: i, ...noPlace[i] }));
const results = sample.map((r) => ({ ...r, ...classify(r.title) }));

const order: Bucket[] = ['reject', 'gap-2a', 'gap-2b', 'subject', 'region', 'festival', 'ambiguous'];
const counts: Record<Bucket, number> = {
  reject: 0, 'gap-2a': 0, 'gap-2b': 0, subject: 0, ambiguous: 0, region: 0, festival: 0,
};
for (const r of results) counts[r.bucket]++;

const csvLines = [
  'index,id,title,bucket,rule',
  ...results.map(
    (r) => `${r.index},"${r.id}","${r.title.replace(/"/g, '""')}",${r.bucket},"${r.rule.replace(/"/g, '""')}"`,
  ),
];
writeFileSync('data/noplace-sample.csv', csvLines.join('\n'));

const pct = (n: number) => ((n / 500) * 100).toFixed(1) + '%';
console.log('=== REVISED BUCKET COUNTS (n=500, seed=42, SAME sample as revision 1) ===');
for (const b of order) console.log(`${b.padEnd(10)} ${String(counts[b]).padStart(4)}  ${pct(counts[b])}`);

console.log('\n=== 10 EXAMPLES PER BUCKET ===');
for (const b of order) {
  console.log(`\n--- ${b} ---`);
  results.filter((r) => r.bucket === b).slice(0, 10).forEach((r) => console.log(`  [${r.rule}] ${r.title}`));
}

// Effective match rate.
const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const matched = index.clips.length;
const totalUnique = 88159;
const rejectShare = counts.reject / 500;
const estimatedRejectInPool = Math.round(noPlace.length * rejectShare);
const effectiveDenominator = totalUnique - estimatedRejectInPool;
const effectiveRate = ((matched / effectiveDenominator) * 100).toFixed(1);

console.log('\n=== EFFECTIVE MATCH RATE ===');
console.log(`raw match rate:      ${((matched / totalUnique) * 100).toFixed(1)}%`);
console.log(`reject share:        ${(rejectShare * 100).toFixed(1)}%  (was 30.0% in revision 1)`);
console.log(`effective match rate (reject excluded): ${effectiveRate}%`);

writeFileSync(
  'data/audit/step0b-summary.json',
  JSON.stringify(
    {
      seed: 42, sampleSize: 500, poolSize: noPlace.length, indices, counts,
      percentages: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, +(v / 5).toFixed(1)])),
      rawMatchRate: +((matched / totalUnique) * 100).toFixed(1),
      effectiveMatchRate: +effectiveRate,
      estimatedRejectInFullPool: estimatedRejectInPool,
    },
    null, 2,
  ),
);

/* --------------------------- 2a hand-audit (precision) --------------------- */

const twoA = results.filter((r) => r.bucket === 'gap-2a');
console.log(`\n=== ALL ${twoA.length} RECORDS NOW IN gap-2a — for hand precision audit ===`);
twoA.forEach((r) => console.log(`[${r.rule}] ${r.title}`));

writeFileSync(
  'data/audit/gap2a-for-precision-audit.json',
  JSON.stringify(twoA, null, 2),
);

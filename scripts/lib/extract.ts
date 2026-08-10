/**
 * Extraction from YouTube metadata.
 *
 * WildFilmsIndia descriptions have a consistent three-zone shape, confirmed
 * against a 200-video sample (zero empty, median 2,402 characters):
 *
 *   1. PROSE     — a written paragraph describing what is actually on screen.
 *                  High signal. This is the only zone a human wrote about
 *                  this specific clip.
 *   2. HASHTAGS  — "#khichan #rajasthan #kurja #migratorybirds". Very high
 *                  signal for place, good for subject, and already normalised.
 *   3. SEO TAIL  — a comma-separated keyword dump. Deliberate keyword
 *                  stuffing. Mentions everything, means nothing.
 *
 * Treating the description as one blob is worse than using the title alone,
 * because the SEO tail matches most of the subject vocabulary on every video.
 * So each zone is scored separately and the tail is ignored for subjects.
 */

import { SUBJECTS, type Subject } from '../../src/lib/types';

export type Zones = {
  prose: string;
  hashtags: string[];
  tail: string;
};

/** Split a description into its three zones. */
export function splitZones(description: string): Zones {
  const lines = description.split('\n');

  const proseLines: string[] = [];
  const hashtags: string[] = [];
  const tailLines: string[] = [];

  // Once we have seen the hashtag block, everything after it is the SEO tail.
  let seenHashtags = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tags = trimmed.match(/#[\p{L}\p{N}_]+/gu);
    // A line is "the hashtag block" if hashtags are most of what's on it.
    if (tags && tags.join('').length > trimmed.length * 0.5) {
      hashtags.push(...tags.map((t) => t.slice(1).toLowerCase()));
      seenHashtags = true;
      continue;
    }

    if (seenHashtags) tailLines.push(trimmed);
    else proseLines.push(trimmed);
  }

  return { prose: proseLines.join(' '), hashtags, tail: tailLines.join(' ') };
}

/* --------------------------------- places -------------------------------- */

export type GazetteerEntry = {
  district: string;
  state: string;
  country?: string;
  region: string;
  terrain: string;
  lat: number;
  lng: number;
  /** 'city' beats 'state' when both appear — prefer the more specific place. */
  kind: 'city' | 'state';
};

export type PlaceHit = {
  placeId: string;
  /** Where the name was found. Drives confidence. */
  source: 'playlist' | 'hashtag' | 'title' | 'prose';
  kind: 'city' | 'state';
  /**
   * True when the name is preceded by a locative preposition — "in Delhi",
   * "at Kaziranga", "near Meerut". This is the strongest available signal that
   * a place is where the camera was, rather than a place merely named.
   */
  locative?: boolean;
  /**
   * True when preceded by an origin marker — "from Tibet", "breed of Tibet",
   * "native to". These mark provenance, which is precisely NOT the venue.
   */
  origin?: boolean;
};

/**
 * Find the best place for a video.
 *
 * Preference order is specificity first, then trust:
 *   a city in the hashtags  >  a city in the title  >  a city in the prose
 *   >  a state in the hashtags  >  a state in the title  >  a state in the prose
 *
 * The SEO tail is never consulted — it name-drops states for reach, not
 * because the footage was shot there.
 */
/**
 * How much of the prose zone may be scanned for a place name.
 *
 * Audited on a 100-clip hand sample: scanning the full prose gave 57.1%
 * precision in that zone and dragged the whole cascade to 78.0%, below the
 * 80% bar. The failure mode is not noise but *drift* — descriptions open by
 * stating what the clip shows, then wander into background: the river's
 * course through other states, where the interviewee took their degree, which
 * region a dance form originates from. All of those read as locations and
 * none of them is where the camera was.
 *
 * Truncating to the first two sentences lifted prose-inclusive precision to
 * 88.0% while costing only 9 of 100 records their location, versus 23 lost by
 * forbidding prose from originating a location at all. Measured, not guessed:
 * see scripts/audit/step3-fixtest.ts.
 */
const PROSE_SENTENCE_LIMIT = 2;

function firstSentences(prose: string, n: number): string {
  return prose.split(/(?<=[.!?])\s+/).slice(0, n).join(' ');
}

export function extractPlace(
  title: string,
  zones: Zones,
  gazetteer: Record<string, GazetteerEntry>,
  aliases: Record<string, string>,
  playlistTitle?: string,
): PlaceHit | null {
  const resolve = (token: string): string | null => {
    const key = token.toLowerCase().trim();
    if (aliases[key]) return aliases[key];
    if (gazetteer[key]) return key;
    return null;
  };

  const hits: PlaceHit[] = [];

  // Hashtags are already tokenised, so match them whole rather than by regex.
  for (const tag of zones.hashtags) {
    const id = resolve(tag);
    if (id) hits.push({ placeId: id, source: 'hashtag', kind: gazetteer[id].kind });
  }

  const scan = (text: string, source: 'playlist' | 'title' | 'prose') => {
    const haystack = text.toLowerCase();
    for (const [name, canonical] of [
      ...Object.entries(aliases),
      ...Object.keys(gazetteer).map((k) => [k, k] as [string, string]),
    ]) {
      // Word-boundary match so "Goa" doesn't fire inside "Goalpara".
      const re = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
      const m = re.exec(haystack);
      if (!m) continue;
      const entry = gazetteer[canonical];
      if (!entry) continue;

      // Look backwards from the match for the preceding word, skipping any
      // punctuation. Matching this in the pattern itself silently dropped
      // every name preceded by a comma ("houseboats, Srinagar") and cost
      // ~1,100 clips their location.
      const before = haystack
        .slice(Math.max(0, m.index - 24), m.index)
        .replace(/[^a-z\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .pop() ?? '';

      hits.push({
        placeId: canonical,
        source,
        kind: entry.kind,
        locative: LOCATIVE.has(before),
        origin: ORIGIN.has(before),
      });
    }
  };


  if (playlistTitle) scan(playlistTitle, 'playlist');
  scan(title, 'title');
  scan(firstSentences(zones.prose, PROSE_SENTENCE_LIMIT), 'prose');

  if (hits.length === 0) return null;

  const kindRank = { city: 0, state: 1 };
  const sourceRank = { playlist: 0, hashtag: 1, title: 2, prose: 3 };

  /*
   * Locative beats everything.
   *
   * Measured on a 100-clip hand audit (seed 307): 6-8% of clips with a place
   * had the WRONG one because a place was named without being the venue — a
   * team in "Pakistan v/s India", an organisation's name ("Tibetan Institute
   * of Performing Arts", filmed in New Delhi), a destination ("road trip to
   * Kathmandu"), a breed's provenance ("Pashmina goat, a breed from Tibet",
   * filmed in Ladakh). In every case the true venue WAS present and marked by
   * a locative preposition, and the false one was not.
   *
   * So grammar outranks both specificity and source trust: "in New Delhi" in
   * the prose beats "Tibet" in a curated playlist title. An explicit origin
   * marker sorts last, below even a bare mention.
   */
  const positional = (h: PlaceHit) => (h.locative ? 0 : h.origin ? 2 : 1);

  hits.sort(
    (a, b) =>
      positional(a) - positional(b) ||
      kindRank[a.kind] - kindRank[b.kind] ||
      sourceRank[a.source] - sourceRank[b.source],
  );

  return hits[0];
}

/** Prepositions that mark where something IS. */
const LOCATIVE = new Set([
  'in', 'at', 'near', 'outside', 'inside', 'around', 'across', 'along',
  'through', 'over', 'above', 'below', 'beside', 'towards', 'toward',
  'within', 'throughout',
]);

/** Markers of provenance — where something came FROM, not where it is. */
const ORIGIN = new Set(['from', 'of', 'native', 'origin', 'originates', 'belongs']);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* -------------------------------- subjects ------------------------------- */

const SUBJECT_KEYWORDS: Record<Subject, string[]> = {
  railway: ['railway', 'railways', 'train', 'locomotive', 'platform', 'junction', 'rail'],
  bazaar: ['bazaar', 'bazar', 'market', 'mandi', 'haat', 'stalls', 'vendors'],
  river: ['river', 'canal', 'backwater', 'stream', 'ghat', 'lake', 'waterfall'],
  school: ['school', 'schoolchildren', 'classroom', 'students', 'pupils'],
  temple: ['temple', 'shrine', 'mosque', 'church', 'gurudwara', 'pilgrim'],
  monsoon: ['monsoon', 'rain', 'rainfall', 'downpour', 'flood', 'flooded', 'drizzle'],
  farmland: ['farm', 'farmland', 'field', 'fields', 'paddy', 'crop', 'harvest', 'plough', 'orchard'],
  'street food': ['street food', 'snack', 'chai', 'tea stall', 'kachori', 'samosa', 'cooking'],
  bus: ['bus', 'buses', 'bus stand', 'depot'],
  coastline: ['coast', 'beach', 'sea', 'shore', 'harbour', 'harbor', 'fishing boat'],
  hills: ['hill', 'hills', 'mountain', 'valley', 'slope', 'ridge', 'himalaya', 'himalayan'],
  festival: ['festival', 'procession', 'mela', 'yatra', 'fair', 'celebration'],
  wildlife: ['wildlife', 'bird', 'birds', 'tiger', 'elephant', 'monkey', 'leopard', 'deer', 'crane'],
  'old town': ['old town', 'old city', 'lanes', 'alley', 'walled city', 'quarter', 'heritage'],
  highway: ['highway', 'road', 'traffic', 'truck', 'expressway', 'flyover'],
  dance: ['dance', 'dancing', 'dancers', 'dancer', 'nritya', 'natyam', 'kathak', 'bharatanatyam', 'odissi', 'kuchipudi', 'bhangra', 'garba', 'folk dance'],
  music: ['music', 'musician', 'singer', 'sings', 'singing', 'song', 'concert', 'orchestra', 'band', 'sitar', 'tabla', 'flute', 'drum', 'drumming', 'qawwali', 'ghazal', 'bhajan', 'kirtan'],
  ceremony: ['ceremony', 'ritual', 'rituals', 'puja', 'prayer', 'prayers', 'aarti', 'worship', 'wedding', 'marriage', 'funeral', 'cremation', 'blessing', 'offering'],
  village: ['village', 'villagers', 'rural', 'hamlet', 'countryside', 'gaon'],
  flowers: ['flower', 'flowers', 'blossom', 'bloom', 'blooming', 'garden', 'orchid', 'rhododendron', 'tulip', 'lily', 'rose', 'poppy', 'botanical'],
  forest: ['forest', 'forests', 'woodland', 'jungle', 'canopy', 'deodar', 'pine', 'oak', 'sanctuary', 'reserve'],
  fort: ['fort', 'fortress', 'citadel', 'ramparts', 'stepwell', 'baoli', 'mausoleum'],
  aerial: ['aerial', 'aerials', 'drone', 'from the air', "bird's eye", 'seen aerially', 'flying over', 'overhead view'],
  crafts: ['handicraft', 'handicrafts', 'craft', 'crafts', 'weaving', 'weaver', 'pottery', 'potter', 'artisan', 'handloom', 'embroidery', 'carving', 'silverware', 'jewellery'],
  industry: ['factory', 'industrial', 'manufacturing', 'workshop', 'labour', 'labourers', 'workers', 'mining', 'mill', 'plant', 'machinery', 'construction'],
  sport: ['cricket', 'football', 'hockey', 'kabaddi', 'wrestling', 'athletics', 'tournament', 'match', 'sport', 'sports', 'olympics', 'marathon', 'race'],
  politics: ['election', 'elections', 'rally', 'parliament', 'minister', 'political', 'protest', 'campaign', 'voting', 'government', 'assembly'],
  snow: ['snow', 'snowfall', 'snowy', 'glacier', 'ice', 'frozen', 'blizzard', 'avalanche', 'winter freeze'],
  birds: ['bird', 'birds', 'barbet', 'kingfisher', 'thrush', 'bulbul', 'parakeet', 'woodpecker', 'eagle', 'owl', 'crane', 'heron', 'egret', 'myna', 'drongo', 'sunbird', 'flycatcher', 'babbler'],
  livestock: ['cattle', 'buffalo', 'buffaloes', 'cow', 'cows', 'goat', 'goats', 'sheep', 'camel', 'camels', 'livestock', 'poultry', 'dairy', 'herd'],
  architecture: ['building', 'buildings', 'architecture', 'mosque', 'church', 'gurudwara', 'tower', 'bridge', 'skyline', 'apartment'],
  boats: ['boat', 'boats', 'ferry', 'houseboat', 'rowing', 'canoe', 'shikara', 'sailing'],
  desert: ['desert', 'dunes', 'sand dunes', 'arid', 'thar'],
  lake: ['lake', 'lakes', 'reservoir', 'pond', 'wetland', 'tso'],
};

/**
 * Score subjects across zones instead of taking the first four matches.
 *
 * Prose is what the clip is; hashtags are what the uploader says it is; the
 * title is a headline. A subject has to clear a threshold to be tagged, so a
 * single passing mention of "road" does not make a clip a highway clip.
 */
export function extractSubjects(title: string, zones: Zones): Subject[] {
  const scored: { subject: Subject; score: number }[] = [];

  for (const subject of SUBJECTS) {
    const kws = SUBJECT_KEYWORDS[subject];
    let score = 0;

    for (const kw of kws) {
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'gi');
      const inProse = (zones.prose.match(re) ?? []).length;
      const inTitle = (title.match(re) ?? []).length;
      const inTags = zones.hashtags.filter((t) => t.includes(kw.replace(/\s+/g, ''))).length;

      score += inTitle * 3 + inTags * 3 + Math.min(inProse, 3) * 2;
    }

    if (score > 0) scored.push({ subject, score });
  }

  scored.sort((a, b) => b.score - a.score);

  // Require real evidence, and never tag more than three — a clip that is
  // "about" five things is about nothing, and the diversity penalty in
  // retrieval depends on subjects being meaningful.
  return scored.filter((s) => s.score >= 4).slice(0, 3).map((s) => s.subject);
}

/* ---------------------------------- year --------------------------------- */

/**
 * Archive footage is usually published decades after it was shot, so the
 * upload date is not the year. Only trust an explicit year in the prose or
 * title; otherwise leave it null and let the UI say nothing.
 */
export function extractYear(title: string, zones: Zones): number | null {
  const match = `${title} ${zones.prose}`.match(/\b(19[3-9]\d|20[0-2]\d)\b/);
  return match ? Number(match[1]) : null;
}

/* -------------------------------- rejection ------------------------------ */

/**
 * Content that is not footage of a place, and never will be.
 *
 * A meaningful slice of this channel is entertainment press — Lakme Fashion
 * Week, film promotion events, celebrity soundbites. That is the exact
 * opposite of the register this product is for, so it is excluded rather than
 * merely left unmatched, which keeps "not eligible" distinct from "we failed
 * to place it" in the ingest report.
 *
 * These patterns were tuned against the real corpus. Earlier, broader
 * versions matched bare "fashion show" and "ramp walk", which threw out
 * legitimate footage — a Mizo winter festival, tribal dress in Shillong.
 * Anything here must be a *commercial* entertainment marker, not a garment.
 */
const NOT_PLACE_FOOTAGE: [name: string, test: RegExp][] = [
  ['fashion week', /\b(lakme fashion|lakmé fashion|india couture week|fashion week)\b/i],
  [
    'film promotion',
    /\b(trailer launch|music launch|film premiere|red carpet|movie promotion|audio launch)\b/i,
  ],
  // Requires an actual opening quote, so "(Bollywood actress) mom in Kolkata
  // sindur khela: Durga puja" — real festival footage — survives.
  ['celebrity soundbite', /\b(?:actor|actress|singer|filmmaker)\b[^:]{0,40}:\s*["“]|\bsays\s+(?:actor|actress|singer)\b/i],
  ['press event', /\bpress (?:conference|meet)\b/i],

  /*
   * Promoted from the Step 0 unmatched-pool classification (AUDIT.md §E-0),
   * which measured 35.2% of no-place records as entertainment-industry content
   * that was never archive footage. This matters more now that clips WITHOUT a
   * place are admitted to the index: without it, admitting them would flood a
   * factual archive with several thousand Bollywood junket clips.
   *
   * DELIBERATELY CONSERVATIVE. Step 0's full name list included common Indian
   * surnames — Singh, Yadav, Shah, Ahmed, Sen — which are not exclusively
   * celebrity names and would reject legitimate footage. Those are excluded
   * here. Only unambiguous entertainment-industry signals are used, so this
   * under-rejects rather than over-rejects. Letting some Bollywood through is a
   * cosmetic problem; discarding real archive footage is not.
   */
  ['bollywood', /\bbollywood\b/i],
  ['film industry event', /\b(?:iifa|filmfare|stardust award|screen award|zee cine)\b/i],
  [
    'entertainment personality',
    /\b(?:amitabh bachchan|shah rukh khan|shahrukh khan|salman khan|aamir khan|akshay kumar|hrithik roshan|priyanka chopra|deepika padukone|aishwarya rai|katrina kaif|kareena kapoor|ranbir kapoor|karan johar|sanjay dutt|sushmita sen|shilpa shetty|bipasha basu|preity zinta|rani mukerji|rani mukherjee|madhuri dixit|juhi chawla|anil kapoor|jackie shroff|govinda|mahesh bhatt|subhash ghai|ram gopal varma|sanjay leela bhansali)\b/i,
  ],
  ['screening', /\b(?:special screening|film screening|movie premiere)\b/i],

  /*
   * Second pass, derived from a 100-clip hand audit of what was still
   * searchable (seed 71). That found 8% leakage, and almost none of it was
   * catchable by adding more names — the survivors were structural:
   * "Satish Kaushik: After the Ram Lakhan song…", "Karan Sharma: My first
   * shoot was…". A junket soundbite is `Name:` followed by first-person
   * speech about a film, whoever the name belongs to.
   *
   * The soundbite rule requires BOTH the quote shape AND a film-industry
   * context word, so "Sadhguru: I believe…" or a scientist quoted about a
   * river does not trip it. That pairing is what keeps this from becoming
   * the over-broad name filter Step 0 warned against.
   */
  [
    'film soundbite',
    /^[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,3}\s*:\s*["'“]?(?:I|I'm|My|We|After|When|It|There)\b.*\b(?:film|movie|shoot|shooting|song|role|cinema|director|actor|actress|serial|script|co-star)\b/i,
  ],
  ['making of', /\bmaking of (?:the )?(?:film|movie|serial)\b/i],

  // Production houses and labels — the corporate side of the same industry.
  [
    'production house',
    /\b(?:yash raj films|dharma productions|balaji telefilms|red chillies|eros international|t-series|utv motion|mukta arts|rajshri productions)\b/i,
  ],
  // Broader than the "trailer launch" phrasings: "Dhoom I | Promotion in the
  // streets of Mumbai" is film marketing but matched none of them.
  ['film marketing', /\b(?:film|movie)\b[^.]{0,40}\bpromotion|\bpromotion[^.]{0,40}\b(?:film|movie)\b/i],
  [
    'film commentary',
    /\bon (?:the )?(?:hindi |tamil |telugu |bengali |marathi |punjabi )?(?:film|movie)\b['"“\s]/i,
  ],
  /*
   * Bare "parties" was too broad — it rejected real footage of Kasol's rave
   * scene in Himachal ("Hippie trail Rave parties"), which is exactly the kind
   * of location material this archive exists for. Narrowed to phrasings that
   * require a person as the subject.
   */
  ['celebrity social', /\b(?:party it up|parties with|spotted partying|bash at|after-party)\b/i],

  // Not content at all — YouTube placeholders for videos that are gone.
  ['unavailable video', /^\s*(?:private|deleted) video\s*$/i],

  /*
   * Full names, not surnames.
   *
   * Step 0 warned that bare surnames (Singh, Yadav, Shah, Sen, Ahmed) are not
   * exclusively celebrity names and would reject real footage. Full names carry
   * no such risk, so this list can be long without being dangerous. Sourced
   * from the frequency-mined bigrams in data/audit/name-freq-bigrams.json plus
   * every name confirmed by the seed-71 and seed-89 hand audits.
   *
   * This catches the residual class the structural rules miss: a celebrity
   * quoted on a NON-film topic ("Konkona Sen: ...we educate girls less than
   * boys", "Suniel Shetty and BMC get together to Clean up Mumbai"), which is
   * celebrity coverage and excluded, but carries no film-context word.
   */
  [
    'entertainment personality (full name)',
    /\b(?:aamir khan|abhay deol|abhishek bachchan|adhyayan suman|adnan sami|aftab shivdasani|aishwarya rai|ajay devgan|ajay devgn|akshay khanna|akshay kumar|ali asgar|aman verma|amitabh bachchan|amrita arora|amrita rao|anil kapoor|anna singh|anu malik|anupam kher|anurag basu|arbaaz khan|arjun rampal|arshad warsi|ashmit patel|ayesha takia|bipasha basu|bobby deol|boman irani|celina jaitley|daisy shah|david dhawan|deepika padukone|dev anand|dia mirza|diana hayden|dilip kumar|dino morea|ekta kapoor|emraan hashmi|esha deol|farah khan|fardeen khan|farhan akhtar|ganesh acharya|geeta basra|gulshan grover|hema malini|hrithik roshan|irrfan khan|jackie shroff|javed akhtar|jaya bachchan|jimmy shergill|john abraham|johnny lever|juhi chawla|kailash kher|kangana ranaut|karan johar|karan oberoi|kareena kapoor|karishma kapoor|katrina kaif|kay kay menon|khalid mohamed|kim sharma|kirron kher|kishore namit kapoor|konkona sen|lara dutta|lata mangeshkar|lucky ali|madhur bhandarkar|madhuri dixit|mahesh bhatt|mahima chaudhary|malaika arora|mallika sherawat|mandira bedi|manish malhotra|manisha koirala|manmohan desai|manoj tiwari|meera vasudevan|meghna naidu|milind soman|mira nair|mithun chakraborty|mrinal sen|nana patekar|naseeruddin shah|neeta lulla|neha dhupia|nitin mukesh|om puri|pankaj berry|parveen babi|pooja bhatt|poonam sinha|preity zinta|prem chopra|priyanka chopra|rahul bose|raj kapoor|rajat bedi|rajesh khanna|rajpal yadav|rakesh roshan|rakhi sawant|ram gopal varma|rani mukerji|rani mukherjee|ravi kishan|rimi sen|rishi kapoor|riteish deshmukh|ritu beri|riya sen|sahil shroff|sai paranjpye|saif ali khan|salman khan|sameera reddy|sanjay dutt|sanjay kapoor|sanjay leela bhansali|sanjay suri|satish kaushik|shabana azmi|shah rukh khan|shahid kapoor|shahrukh khan|shamita shetty|sharmila tagore|shilpa shetty|shreyas talpade|shweta kawaatra|shyam benegal|soha ali khan|sohail khan|sonu nigam|sonu sood|sooraj barjatya|soumitra chatterjee|subhash ghai|suchitra krishnamoorthi|suniel shetty|sunil shetty|sunny deol|suresh wadkar|sushmita sen|tara deshpande|tusshar kapoor|upen patel|urmila matondkar|vidhu vinod chopra|vidya balan|vikram bhatt|vikram phadnis|vivek oberoi|yash chopra|yash tonk|zarina wahab|zayed khan|zeenat aman|danny denzongpa|usha uthup|kavita krishnamurthy|alka yagnik|udit narayan|kumar sanu|shreya ghoshal|sunidhi chauhan|himesh reshammiya|annu kapoor|raveena tandon|twinkle khanna|sonali bendre|isha koppikar|bhagyashree|ashutosh gowariker|rohit shetty|anees bazmee|priyadarshan|rajkumar hirani|yash raj|vishal bhardwaj|imtiaz ali|zoya akhtar|kabir khan)\b/i,
  ],
];

export function isRejected(title: string, zones: Zones): string | null {
  // Title only. The prose often mentions a film or an actor in passing, and
  // matching on it rejected footage that was simply described in context.
  void zones;
  for (const [name, test] of NOT_PLACE_FOOTAGE) {
    if (test.test(title)) return name;
  }
  return null;
}

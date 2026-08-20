/**
 * Core domain types for Clipahoy.
 *
 * The controlled vocabularies below are deliberately closed. Nothing outside
 * SUBJECTS may ever be written into a Clip: the loader rejects unknown tags at
 * boot rather than serving an archive whose vocabulary has quietly drifted.
 */

export const SUBJECTS = [
  'railway',
  'bazaar',
  'river',
  'school',
  'temple',
  'monsoon',
  'farmland',
  'street food',
  'bus',
  'coastline',
  'hills',
  'festival',
  'wildlife',
  'old town',
  'highway',

  /*
   * Second-generation tags, added after AUDIT.md §J found 31.8% of clips
   * carried none of the original 15. Chosen from term frequency across the
   * untagged population itself, not guessed: dance (1,043 clips), village
   * (804), music (671), aerial (581), fort (434), ceremony (455), flowers
   * (404). Still a closed vocabulary, still rule-based — no LLM pass, per the
   * audit's recommendation that one has to earn its place against free-text
   * search over 2,000-character descriptions, and does not.
   */
  'dance',
  'music',
  'ceremony',
  'village',
  'flowers',
  'forest',
  'fort',
  'aerial',
  'crafts',
  'industry',
  'sport',
  'politics',
  'snow',
  'birds',
  'livestock',
  'architecture',
  'boats',
  'desert',
  'lake',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const REGIONS = [
  'North',
  'Northeast',
  'East',
  'West',
  'South',
  'Central',
  /** Everything outside India. Kept coarse — we do not sub-region the world. */
  'Outside India',
] as const;

export type Region = (typeof REGIONS)[number];

export const TERRAINS = [
  'dry plains',
  'hills',
  'coastal',
  'delta',
  'river valley',
  'desert',
  'plateau',
] as const;

export type Terrain = (typeof TERRAINS)[number];

export type Clip = {
  /**
   * "SEED_0001" while we are running on seed data, a real YouTube ID once
   * scripts/ingest.ts has produced data/index.json. Never hand-write an
   * eleven-character ID — see isPlaceholder.
   */
  id: string;
  title: string;
  /**
   * The prose zone of the YouTube description — the paragraph a human wrote
   * about this specific clip, with the hashtag block and the SEO keyword tail
   * stripped. This is what free-text search runs against; searching the raw
   * description would match everything, because the tail name-drops the whole
   * vocabulary on every video. Averages ~450 characters.
   */
  text: string;
  /**
   * null when no location could be identified.
   *
   * Roughly a third of the corpus (AUDIT.md §D) names no place at all — much
   * of it wildlife and nature footage that is legitimately unplaceable rather
   * than an extraction failure. Those clips are still indexed and searchable so
   * long as they carry a subject tag; a search for "leopard" should not come
   * back empty because nobody wrote down which forest it was.
   */
  placeId: string | null;
  subjects: Subject[];
  year: number | null;
  /**
   * When YouTube received the video — NOT when it was filmed.
   *
   * Kept because a shoot is uploaded as one batch, so clips sharing a
   * timestamp to the second came from the same session: five Jama Masjid
   * biryani vendors all read 2016-09-27T06:15:34Z. 20.9% of indexed clips
   * share a timestamp with at least one other, which makes this the most
   * direct "same shoot" signal available. The feed uses it to avoid filling a
   * row with one afternoon.
   *
   * Do not surface this as a filming date. `year`, scraped from the prose, is
   * the archive's own claim about when footage was shot, and even that is
   * wrong 30.9% of the time where it can be checked.
   */
  uploadedAt: string | null;
  /**
   * True when `id` is not a real YouTube ID. The UI must render a labelled
   * grey tile rather than an embed, so a placeholder can never masquerade as
   * missing footage.
   */
  isPlaceholder: boolean;
};

export type Place = {
  id: string;
  name: string;
  district: string;
  /**
   * The state, province or equivalent. For non-India places this holds the
   * province ("Bagmati") or repeats the country where no useful subdivision
   * applies.
   */
  state: string;
  /**
   * Country. Defaults to "India" — the archive is overwhelmingly Indian — but
   * it holds real footage from ~25 other countries, heavily Nepal, Bhutan and
   * Tibet. That material is included on purpose (AUDIT.md §K); excluding it
   * would re-impose an India-only assumption the data does not support.
   */
  country: string;
  region: Region;
  terrain: Terrain;
  lat: number;
  lng: number;
  /** subject -> clip count in this place. Derived by the loader, never authored. */
  coverage: Partial<Record<Subject, number>>;
};

/** The shape actually stored on disk. `coverage` is computed by the loader. */
export type RawPlace = Omit<Place, 'coverage'>;

export type ArchiveFile = {
  /** "seed" or the ISO date of the ingest run that produced this file. */
  source: string;
  places: RawPlace[];
  clips: Clip[];
};

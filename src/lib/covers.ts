import 'server-only';

import { clipsForPlace, clipsForSubject } from './search';
import type { Clip, Subject } from './types';

/**
 * Cover art selection for place and subject tiles.
 *
 * The obvious implementation — take the place's top clip — kept choosing
 * talking-head close-ups, because `clipsForPlace` ranks on title length and
 * interview clips have long titles. A grid of ten places then read as a grid
 * of ten strangers' faces.
 *
 * Preferring a clip tagged with something that *establishes* a location fixes
 * it without any hand-curation: a skyline, a fort, a street, a hillside.
 */
const ESTABLISHING: Subject[] = [
  'aerial',
  'architecture',
  'old town',
  'fort',
  'coastline',
  'hills',
  'river',
  'bazaar',
  'highway',
  'temple',
  'village',
  'farmland',
  'lake',
  'desert',
  'snow',
  'forest',
  'railway',
];

const rank = new Map(ESTABLISHING.map((s, i) => [s, i]));

function best(clips: Clip[], used?: Set<string>): Clip | undefined {
  let winner: Clip | undefined;
  let winnerRank = Infinity;

  for (const clip of clips) {
    if (used?.has(clip.id)) continue;

    let score = Infinity;
    for (const subject of clip.subjects) {
      const r = rank.get(subject);
      if (r !== undefined && r < score) score = r;
    }

    if (score < winnerRank) {
      winner = clip;
      winnerRank = score;
    }
    // Nothing can beat the top-ranked subject, so stop early.
    if (winnerRank === 0) break;
  }

  // Fall back to the first unused clip, then to the first clip at all, so a
  // place with no establishing footage still gets a picture.
  return winner ?? clips.find((c) => !used?.has(c.id)) ?? clips[0];
}

/** Cover for a place tile. `used` keeps adjacent tiles from repeating a frame. */
export function coverForPlace(placeId: string, used?: Set<string>): string | undefined {
  const clip = best(clipsForPlace(placeId, 24).clips, used);
  if (clip) used?.add(clip.id);
  return clip?.id;
}

/**
 * Cover for a subject tile.
 *
 * Deduping matters more here: a clip carries several subjects, so the plain
 * top hit put one frame on both Temple and Dance, and again on Wildlife and
 * Birds — 34 tiles showing 26 pictures.
 *
 * But dedup alone picked whatever was left. The tile labelled *Flowers* was
 * fronted by "Plastic waste dumped across a green Himalayan hillside" — tagged
 * `flowers`, and first in line once the better frames had gone to other tiles.
 * A tile names its subject, so the picture should show it: clips whose TITLE
 * says the word lead, and the old behaviour is the fallback for a subject too
 * thin to offer one.
 */
export function coverForSubject(subject: Subject, used?: Set<string>): string | undefined {
  // Widened from 24: the on-topic filter needs something to choose from once
  // the earlier tiles have taken their frames.
  const clips = clipsForSubject(subject, 0, 60).clips;

  // "street food" -> ["street", "food"]; trailing s dropped so `flowers`
  // matches a title saying "flower".
  const needles = subject
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/s$/, ''))
    .filter((w) => w.length > 2);

  const onTopic = clips.find(
    (c) => !used?.has(c.id) && needles.some((n) => c.title.toLowerCase().includes(n)),
  );

  const clip = onTopic ?? clips.find((c) => !used?.has(c.id)) ?? clips[0];
  if (clip) used?.add(clip.id);
  return clip?.id;
}

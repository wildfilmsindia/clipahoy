import 'server-only';

import { getPlace } from './archive';
import { blurb, describeClip, describeLocation } from './describe';
import type { Clip } from './types';
import type { CardData } from '@/components/VideoCard';

/**
 * Compose clips into renderable cards.
 *
 * Every page that shows results goes through here, so the "one sentence, never
 * a tag dump" rule cannot drift between search, place and subject pages.
 * placeId is null for legitimately unplaceable footage (wildlife, nature);
 * those render on their title alone with no location line.
 */
export function toCards(clips: Clip[]): CardData[] {
  return clips.map((clip) => {
    const place = clip.placeId ? getPlace(clip.placeId) : undefined;
    const sentence = describeClip(clip, place);
    return {
      clip,
      sentence,
      location: describeLocation(clip, place, sentence),
      blurb: blurb(clip.text),
    };
  });
}

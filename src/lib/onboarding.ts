import 'server-only';

import { search } from './search';

/**
 * One real clip per onboarding question, blurred behind the interface.
 *
 * Resolved from live queries rather than hardcoded ids, so this cannot rot
 * into pointing at footage that has left the archive.
 */
export function backdropClips(): string[] {
  /*
   * One per question, loosely matching what each asks about, so the frame
   * behind the field belongs with the question rather than cycling at random.
   */
  return [
    'village town houses street',
    'family home courtyard village',
    'school children classroom',
    'Himalaya valley aerial landscape',
    'street food stall market',
    'elephant tiger wildlife forest',
    'temple fort heritage city',
    'festival procession crowd',
    'flowers garden blossom',
    'birds perched tree',
    'tiger safari national park',
    'monsoon rain clouds',
    'city traffic crowd street',
    'craft pottery handloom artisan',
    'dance music performance stage',
  ]
    .map((q) => search(q, 1)[0]?.clip.id)
    .filter((id): id is string => !!id);
}

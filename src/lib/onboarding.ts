import 'server-only';

import { search } from './search';

/**
 * One real clip per onboarding question, blurred behind the interface.
 *
 * Resolved from live queries rather than hardcoded ids, so this cannot rot
 * into pointing at footage that has left the archive.
 */
export function backdropClips(): string[] {
  return [
    'Bombay street crowd city',
    'village town houses',
    'Himalaya coast valley sea',
    'railway station platform train',
    'festival procession market',
  ]
    .map((q) => search(q, 1)[0]?.clip.id)
    .filter((id): id is string => !!id);
}

import { cookies } from 'next/headers';

import { suggestionVocabulary } from '@/lib/interpret';
import { backdropClips } from '@/lib/onboarding';
import { TASTE_COOKIE, decodeTaste } from '@/lib/taste';
import { Onboarding } from '@/components/Onboarding';

export const metadata = {
  title: 'Tune your India',
  description: 'Five quick questions, and we will build you a personal archive feed.',
};

/**
 * The questions on their own route.
 *
 * `/` shows these automatically to a first-time visitor, but they also need a
 * stable address so "Tune your archive" has somewhere to go and so the flow
 * can be linked. Answering here rewrites the cookie and returns to `/`.
 */
export default async function StartPage() {
  // Re-tuning opens on what you said last time, so it reads as an edit.
  const previous = decodeTaste((await cookies()).get(TASTE_COOKIE)?.value);

  return (
    <Onboarding
      redirectOnDone
      vocabulary={suggestionVocabulary()}
      backdropClips={backdropClips()}
      initialAnswers={previous ?? undefined}
    />
  );
}

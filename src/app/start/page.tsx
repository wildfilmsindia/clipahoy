import { suggestionVocabulary } from '@/lib/interpret';
import { backdropClips } from '@/lib/onboarding';
import { Onboarding } from '@/components/Onboarding';

export const metadata = {
  title: 'Tune your India',
  description: 'A few quick questions, and we will build you a personal archive feed.',
};

/**
 * The questions on their own route.
 *
 * `/` shows these automatically to a first-time visitor, but they also need a
 * stable address so "Curate your India" has somewhere to go and so the flow
 * can be linked. Answering here rewrites the cookie and returns to `/`.
 *
 * Opens with empty fields every time: making a new archive is a fresh start,
 * not an edit of the last one. Reading nothing request-specific here keeps the
 * page static.
 */
export default function StartPage() {
  return (
    <Onboarding redirectOnDone vocabulary={suggestionVocabulary()} backdropClips={backdropClips()} />
  );
}

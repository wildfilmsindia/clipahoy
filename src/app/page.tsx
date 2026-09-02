import { cookies } from 'next/headers';

import { recommend } from '@/lib/recommend';
import { suggestionVocabulary } from '@/lib/interpret';
import { backdropClips } from '@/lib/onboarding';
import { TASTE_COOKIE, decodeTaste, encodeShare, hasAnswers } from '@/lib/taste';
import { Onboarding } from '@/components/Onboarding';
import { PersonalFeed } from '@/components/PersonalFeed';
import { ArchiveHome } from '@/components/ArchiveHome';

export default async function Home() {
  const answers = decodeTaste((await cookies()).get(TASTE_COOKIE)?.value);

  // No cookie at all means a genuinely new visitor: ask before showing.
  if (!answers) {
    return <Onboarding vocabulary={suggestionVocabulary()} backdropClips={backdropClips()} />;
  }

  // Every question skipped. Honour that with the archive's own front page
  // rather than pretending a personalised one was built.
  if (!hasAnswers(answers)) return <ArchiveHome />;

  const rec = recommend(answers);
  if (rec.thin) return <ArchiveHome thinPersonalisation />;

  /*
   * The share link carries the answers, so it can be built here without any
   * stored record. Relative on purpose: an absolute URL would need the deployed
   * origin, which differs between local, preview and production — the button
   * resolves it against the current page instead.
   */
  return <PersonalFeed rec={rec} shareUrl={`/shared?a=${encodeShare(answers)}`} />;
}

import type { Metadata } from 'next';
import Link from 'next/link';

import { recommend } from '@/lib/recommend';
import { decodeShare } from '@/lib/taste';
import { PersonalFeed } from '@/components/PersonalFeed';

/**
 * Somebody else's curated India, rebuilt from the link.
 *
 * There is no stored record behind a share: the feed is a pure function of the
 * answers, and the answers travel in the URL. That means a link needs no
 * account, cannot expire, and keeps working for anyone who opens it.
 *
 * The visitor's own cookie is deliberately ignored here — opening a friend's
 * link must show the friend's India, not silently re-personalise it, and it
 * must not overwrite whatever the visitor curated for themselves.
 */

type Props = { searchParams: Promise<{ a?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const answers = decodeShare((await searchParams).a);
  if (!answers) return { title: 'Shared archive', robots: { index: false, follow: false } };

  // The answers themselves make the best preview line — this is what shows in
  // WhatsApp, which is how these links will actually travel.
  const said = Object.values(answers).slice(0, 5).join(' · ');

  return {
    title: 'Their India',
    description: `A tour of India curated from ${said}. Answer the same questions and build your own.`,
    openGraph: {
      title: 'Their India — curated on Clipahoy',
      description: `Curated from ${said}.`,
    },
    // A share link is one person's answers, not a page worth indexing, and
    // there could be unlimited variants of it.
    robots: { index: false, follow: true },
  };
}

export default async function SharedPage({ searchParams }: Props) {
  const answers = decodeShare((await searchParams).a);

  // A truncated, edited or stale link. Say so plainly and offer the way in,
  // rather than 404ing on something a friend sent.
  if (!answers) return <BrokenLink />;

  const rec = recommend(answers);
  if (rec.thin) return <BrokenLink thin />;

  return <PersonalFeed rec={rec} shared />;
}

function BrokenLink({ thin = false }: { thin?: boolean }) {
  return (
    <main className="shell flex flex-col items-center py-28 text-center sm:py-36">
      <p className="eyebrow">Shared archive</p>
      <h1 className="mt-4 font-display text-[32px] leading-tight font-light sm:text-[42px]">
        This link didn&rsquo;t open.
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">
        {thin
          ? 'The answers in this link matched too little of the archive to build a feed from.'
          : 'The link may have been cut short when it was sent, or it was made before the questions changed.'}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/start" className="btn btn-primary">
          Curate your own India
        </Link>
        <Link href="/search" className="btn btn-ghost">
          Search the archive
        </Link>
      </div>
    </main>
  );
}

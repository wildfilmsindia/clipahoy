import Link from 'next/link';

import { getPlace } from '@/lib/archive';
import { describeClip, describeLocation } from '@/lib/describe';
import { search } from '@/lib/search';
import { ClipGrid, type ClipCard } from '@/components/ClipGrid';
import { SearchBar } from '@/components/SearchBar';

export const metadata = { title: 'Search — Clipahoy' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim().slice(0, 120);
  const hits = query ? search(query, 60) : [];

  // Compose each result into one sentence rather than surfacing raw fields.
  const cards: ClipCard[] = hits.map(({ clip }) => {
    // placeId is null for unplaceable footage (wildlife, nature); those clips
    // render on their title alone, with no location line.
    const place = clip.placeId ? getPlace(clip.placeId) : undefined;
    const sentence = describeClip(clip, place);
    return { clip, sentence, location: describeLocation(clip, place, sentence) };
  });

  return (
    <main className="px-6 pt-8 pb-24 sm:px-10">
      <header className="mx-auto w-full max-w-2xl lg:max-w-4xl">
        <Link href="/" className="text-[11px] tracking-[0.18em] text-muted uppercase hover:text-paper">
          Clipahoy
        </Link>
        <div className="mt-6 max-w-xl">
          <SearchBar initial={query} />
        </div>

        {query && (
          <p className="mt-5 text-[13px] text-slate">
            {cards.length === 0
              ? `Nothing in the archive matches “${query}”.`
              : `${cards.length}${cards.length === 60 ? '+' : ''} ${
                  cards.length === 1 ? 'clip' : 'clips'
                } for “${query}”`}
          </p>
        )}
      </header>

      <div className="mx-auto mt-10 w-full max-w-2xl lg:max-w-4xl">
        {query && cards.length === 0 ? (
          <p className="max-w-md text-[15px] leading-relaxed text-muted">
            Try a plainer word — the archive responds better to what is on screen (rain, market,
            bridge, temple) than to a title or a proper name.
          </p>
        ) : (
          <ClipGrid cards={cards} />
        )}
      </div>
    </main>
  );
}

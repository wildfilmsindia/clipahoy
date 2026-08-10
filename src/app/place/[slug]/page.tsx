import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getCoveredPlaces, getPlace } from '@/lib/archive';
import { describeClip, describeLocation } from '@/lib/describe';
import { clipsForPlace } from '@/lib/search';
import { ClipGrid, type ClipCard } from '@/components/ClipGrid';
import { SearchBar } from '@/components/SearchBar';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = getPlace(decodeURIComponent(slug));
  if (!place) return { title: 'Clipahoy' };
  return {
    title: `${place.name} — Clipahoy`,
    description: `Archive footage of ${place.name}, ${place.state}, from the Wilderness Films archive.`,
  };
}

export default async function PlacePage({ params }: Props) {
  const { slug } = await params;
  const place = getPlace(decodeURIComponent(slug));
  if (!place) notFound();

  const { clips, total } = clipsForPlace(place.id, 60);

  const cards: ClipCard[] = clips.map((clip) => {
    const sentence = describeClip(clip, place);
    return { clip, sentence, location: describeLocation(clip, place, sentence) };
  });

  // A few other well-covered places, so a dead end always offers a way on.
  const others = getCoveredPlaces(20)
    .filter((c) => c.place.id !== place.id)
    .slice(0, 8);

  return (
    <main className="px-6 pt-8 pb-24 sm:px-10">
      <header className="mx-auto w-full max-w-2xl lg:max-w-4xl">
        <Link href="/" className="text-[11px] tracking-[0.18em] text-muted uppercase hover:text-paper">
          Clipahoy
        </Link>

        <h1 className="mt-6 font-display text-[2.2rem] leading-[1.08] font-light sm:text-5xl">
          {place.name}
        </h1>
        <p className="mt-2 font-display text-[15px] font-light text-slate italic">
          {place.district === place.name ? place.state : `${place.district}, ${place.state}`}
          <span className="text-muted not-italic">
            {' · '}
            {total.toLocaleString()} clips
            {total > clips.length && ` · showing ${clips.length}`}
          </span>
        </p>

        <div className="mt-8 max-w-xl">
          <SearchBar />
        </div>
      </header>

      <div className="mx-auto mt-12 w-full max-w-2xl lg:max-w-4xl">
        <ClipGrid cards={cards} />
      </div>

      <footer className="mx-auto mt-20 w-full max-w-2xl border-t border-hairline pt-10 lg:max-w-4xl">
        <h2 className="text-[11px] tracking-[0.18em] text-muted uppercase">Elsewhere in the archive</h2>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {others.map(({ place: p }) => (
            <li key={p.id}>
              <Link
                href={`/place/${p.id}`}
                className="font-display text-lg font-light text-slate underline-offset-4 transition-colors hover:text-paper hover:underline"
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </footer>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getCoveredPlaces, getPlace } from '@/lib/archive';
import { clipsForPlace } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { ClipGrid } from '@/components/ClipGrid';
import { Pager } from '@/components/Pager';

const PAGE_SIZE = 24;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = getPlace(decodeURIComponent(slug));
  if (!place) return { title: 'Place not found' };
  return {
    title: place.name,
    description: `Archive footage of ${place.name}, ${place.country !== 'India' ? place.country : place.state}.`,
  };
}

export default async function PlacePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const place = getPlace(decodeURIComponent(slug));
  if (!place) notFound();

  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { clips, total } = clipsForPlace(place.id, Number.MAX_SAFE_INTEGER);
  const pageClips = clips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const cards = toCards(pageClips);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const region = place.country !== 'India' ? place.country : place.state;
  const others = getCoveredPlaces(20)
    .filter((c) => c.place.id !== place.id)
    .slice(0, 12);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
      <header className="border-b border-line-soft pb-6">
        <nav aria-label="Breadcrumb" className="mb-3">
          <Link href="/places" className="text-[13px] text-faint transition-colors hover:text-mute">
            Places
          </Link>
        </nav>
        <h1 className="font-display text-[28px] leading-tight font-light sm:text-[36px]">
          {place.name}
        </h1>
        <p className="mt-3 text-[14px] text-mute">
          {place.district !== place.name ? `${place.district}, ${region}` : region}
          <span className="text-faint">
            {' · '}
            {total.toLocaleString()} {total === 1 ? 'clip' : 'clips'}
            {lastPage > 1 && ` · page ${page} of ${lastPage}`}
          </span>
        </p>
      </header>

      <div className="mt-10">
        <ClipGrid cards={cards} />
      </div>

      <Pager
        page={page}
        lastPage={lastPage}
        href={(p) => `/place/${place.id}?page=${p}`}
      />

      <section className="mt-16 border-t border-line-soft pt-8">
        <p className="eyebrow">Elsewhere in the archive</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map(({ place: p }) => (
            <li key={p.id}>
              <Link href={`/place/${p.id}`} className="chip">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

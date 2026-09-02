import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getCoveredPlaces, getPlace } from '@/lib/archive';
import { clipsForPlace } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { VideoCard } from '@/components/VideoCard';
import { VideoGrid } from '@/components/VideoGrid';
import { Pager } from '@/components/Pager';
import { Thumbnail } from '@/components/Thumbnail';
import type { Subject } from '@/lib/types';

const PAGE_SIZE = 23;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = getPlace(decodeURIComponent(slug));
  if (!place) return { title: 'Place not found' };
  const region = place.country !== 'India' ? place.country : place.state;
  return { title: place.name, description: `Archive footage of ${place.name}, ${region}.` };
}

export default async function PlacePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const place = getPlace(decodeURIComponent(slug));
  if (!place) notFound();

  const { clips: all, total } = clipsForPlace(place.id, Number.MAX_SAFE_INTEGER);

  /*
   * Floored and clamped, for the same reason as the subject page: `?page=
   * 999999` rendered a place page with no hero and no clips at all.
   */
  const requestedPage = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
  const lastPage = Math.max(1, Math.ceil((total - 1) / PAGE_SIZE));
  const page = Math.min(requestedPage, lastPage);

  const offset = page === 1 ? 0 : 1 + (page - 1) * PAGE_SIZE;
  const slice = all.slice(offset, offset + (page === 1 ? PAGE_SIZE + 1 : PAGE_SIZE));
  const cards = toCards(slice);

  const hero = page === 1 ? cards[0] : undefined;
  const rest = page === 1 ? cards.slice(1) : cards;

  // What this place is actually known for, from its own clips.
  const tally = new Map<Subject, number>();
  for (const c of all) for (const s of c.subjects) tally.set(s, (tally.get(s) ?? 0) + 1);
  const topSubjects = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const region = place.country !== 'India' ? place.country : place.state;
  const others = getCoveredPlaces(20).filter((c) => c.place.id !== place.id).slice(0, 12);

  return (
    <main>
      <header className="relative overflow-hidden border-b border-line-soft">
        {hero && (
          <>
            <Thumbnail
              videoId={hero.clip.id}
              eager
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/50" />
          </>
        )}
        <div className="shell relative py-14 sm:py-20">
          <nav aria-label="Breadcrumb">
            <Link href="/places" className="text-[13px] text-faint transition-colors hover:text-accent">
              Places
            </Link>
          </nav>
          <h1 className="rise mt-3 font-display text-[38px] leading-none font-light sm:text-[58px]">
            {place.name}
          </h1>
          <p className="rise mt-4 text-[15px] text-mute" style={{ animationDelay: '60ms' }}>
            {place.district !== place.name ? `${place.district}, ${region}` : region}
            <span className="text-faint">
              {' · '}
              <span className="text-paper tabular-nums">{total.toLocaleString()}</span> clips
              {lastPage > 1 && ` · page ${page} of ${lastPage}`}
            </span>
          </p>

          {topSubjects.length > 0 && (
            <ul className="rise mt-6 flex flex-wrap gap-2" style={{ animationDelay: '110ms' }}>
              {topSubjects.map(([s, n]) => (
                <li key={s}>
                  <Link href={`/subject/${encodeURIComponent(s)}`} className="chip capitalize">
                    {s}
                    <span className="tabular-nums opacity-60">{n}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="shell py-12">
        {hero && (
          <div className="mb-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <VideoCard data={hero} size="large" eager index={0} />
            <ul className="hidden space-y-4 lg:block">
              {rest.slice(0, 4).map((c, i) => (
                <li key={c.clip.id}><VideoCard data={c} size="row" index={i} /></li>
              ))}
            </ul>
          </div>
        )}

        <VideoGrid cards={hero ? rest.slice(4) : rest} eagerCount={0} />

        <Pager
          page={page}
          lastPage={lastPage}
          href={(p) => `/place/${place.id}${p > 1 ? `?page=${p}` : ''}`}
        />

        <section className="mt-16 border-t border-line-soft pt-8">
          <p className="eyebrow">Elsewhere in the archive</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map(({ place: p, clips }) => (
              <li key={p.id}>
                <Link href={`/place/${p.id}`} className="chip">
                  {p.name}
                  <span className="tabular-nums opacity-60">{clips}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

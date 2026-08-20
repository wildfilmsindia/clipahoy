import Link from 'next/link';

import { getPlace } from '@/lib/archive';
import { search } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { VideoGrid } from '@/components/VideoGrid';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/Pager';
import type { Subject } from '@/lib/types';

const PAGE_SIZE = 24;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return { title: q ? q : 'Search' };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; subject?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim().slice(0, 120);
  const page = Math.max(1, Number(sp.page) || 1);
  const activeSubject = sp.subject;

  // Facets are derived from the FULL result set, not the current page, so the
  // counts describe the query rather than what happens to be on screen.
  const all = query ? search(query, Number.MAX_SAFE_INTEGER) : [];

  const subjectTally = new Map<Subject, number>();
  const placeTally = new Map<string, number>();
  for (const { clip } of all) {
    for (const s of clip.subjects) subjectTally.set(s, (subjectTally.get(s) ?? 0) + 1);
    if (clip.placeId) placeTally.set(clip.placeId, (placeTally.get(clip.placeId) ?? 0) + 1);
  }

  const topSubjects = [...subjectTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topPlaces = [...placeTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  const filtered = activeSubject
    ? all.filter((h) => h.clip.subjects.includes(activeSubject as Subject))
    : all;

  const total = filtered.length;
  const cards = toCards(
    filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((h) => h.clip),
  );
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (p: number) => {
    const params = new URLSearchParams({ q: query });
    if (activeSubject) params.set('subject', activeSubject);
    if (p > 1) params.set('page', String(p));
    return `/search?${params}`;
  };

  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      <header className="rise">
        <p className="eyebrow">Search results</p>
        <h1 className="mt-2.5 font-display text-[30px] leading-tight font-light sm:text-[42px]">
          {query ? <>&ldquo;{query}&rdquo;</> : 'Search the archive'}
        </h1>

        {query && total > 0 && (
          <p className="mt-3 text-[14px] text-mute">
            <span className="text-paper tabular-nums">{total.toLocaleString()}</span>{' '}
            {total === 1 ? 'clip' : 'clips'}
            {activeSubject && (
              <>
                {' '}
                in <span className="text-accent capitalize">{activeSubject}</span>
              </>
            )}
            {lastPage > 1 && <span className="text-faint"> · page {page} of {lastPage}</span>}
          </p>
        )}
      </header>

      {/* --------------------------------------------------------- facets */}
      {query && all.length > 0 && (topSubjects.length > 0 || topPlaces.length > 0) && (
        <div
          className="rise mt-7 flex flex-col gap-3 border-y border-line-soft py-4"
          style={{ animationDelay: '60ms' }}
        >
          {topSubjects.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="eyebrow hidden shrink-0 sm:block">Subject</span>
              <ul className="rail flex-1">
                <li>
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}`}
                    data-active={!activeSubject}
                    className="chip"
                  >
                    All
                  </Link>
                </li>
                {topSubjects.map(([s, n]) => (
                  <li key={s}>
                    <Link
                      href={`/search?q=${encodeURIComponent(query)}&subject=${encodeURIComponent(s)}`}
                      data-active={activeSubject === s}
                      className="chip capitalize"
                    >
                      {s}
                      <span className="tabular-nums opacity-60">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {topPlaces.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="eyebrow hidden shrink-0 sm:block">Place</span>
              <ul className="rail flex-1">
                {topPlaces.map(([id, n]) => {
                  const place = getPlace(id);
                  if (!place) return null;
                  return (
                    <li key={id}>
                      <Link href={`/place/${id}`} className="chip">
                        {place.name}
                        <span className="tabular-nums opacity-60">{n}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------- results */}
      {!query ? (
        <EmptyState
          title="Nothing searched yet"
          body="The archive responds best to what is on screen — rain, a market, a bridge, a temple, a town name."
          suggestions={['Bombay streets', 'Indian railways', 'Himalayas', 'monsoon']}
        />
      ) : total === 0 ? (
        <EmptyState
          title={`Nothing matches “${query}”${activeSubject ? ` in ${activeSubject}` : ''}`}
          body="Try a plainer word, or drop the filter. Footage here is described by what the camera saw rather than by title or proper name."
          suggestions={['monsoon', 'railway', 'bazaar', 'coast', 'festival']}
        />
      ) : (
        <>
          <div className="mt-9">
            <VideoGrid cards={cards} />
          </div>
          <Pager page={page} lastPage={lastPage} href={buildHref} />
        </>
      )}

      {query && total > 0 && (
        <p className="mt-16 border-t border-line-soft pt-6 text-[13px] text-faint">
          Every clip here is available to license.{' '}
          <a
            href="https://www.wildfilmsindia.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mute underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          >
            Contact Wilderness Films
          </a>
        </p>
      )}
    </main>
  );
}

import Link from 'next/link';

import { searchPage } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { ClipGrid } from '@/components/ClipGrid';
import { EmptyState } from '@/components/EmptyState';
import { Pager } from '@/components/Pager';

const PAGE_SIZE = 24;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return { title: q ? `${q}` : 'Search' };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim().slice(0, 120);
  const page = Math.max(1, Number(sp.page) || 1);

  const { hits, total } = query
    ? searchPage(query, (page - 1) * PAGE_SIZE, PAGE_SIZE)
    : { hits: [], total: 0 };

  const cards = toCards(hits.map((h) => h.clip));
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
      <header className="border-b border-line-soft pb-6">
        <p className="eyebrow">Search</p>
        <h1 className="mt-2.5 font-display text-[28px] leading-tight font-light sm:text-[36px]">
          {query ? <>&ldquo;{query}&rdquo;</> : 'Search the archive'}
        </h1>

        {query && total > 0 && (
          <p className="mt-3 text-[14px] text-mute">
            {total.toLocaleString()} {total === 1 ? 'clip' : 'clips'}
            {lastPage > 1 && (
              <span className="text-faint">
                {' '}
                · page {page} of {lastPage}
              </span>
            )}
          </p>
        )}
      </header>

      {!query ? (
        <EmptyState
          title="Nothing searched yet"
          body="Type a word into the field above — the archive responds best to what is on screen: rain, market, bridge, temple, a town name."
        />
      ) : total === 0 ? (
        <EmptyState
          title={`Nothing matches “${query}”`}
          body="Try a plainer word. The archive is described in terms of what the camera saw, so “rain” finds more than a film title or a proper name would."
          suggestions={['monsoon', 'railway', 'bazaar', 'coast', 'festival']}
        />
      ) : (
        <>
          <div className="mt-10">
            <ClipGrid cards={cards} />
          </div>
          <Pager
            page={page}
            lastPage={lastPage}
            href={(p) => `/search?q=${encodeURIComponent(query)}&page=${p}`}
          />
        </>
      )}

      {query && total > 0 && (
        <p className="mt-14 border-t border-line-soft pt-6 text-[13px] text-faint">
          Looking to license footage?{' '}
          <Link
            href="https://www.wildfilmsindia.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="text-mute underline decoration-line underline-offset-4 transition-colors hover:text-paper hover:decoration-accent"
          >
            Contact Wilderness Films
          </Link>
        </p>
      )}
    </main>
  );
}

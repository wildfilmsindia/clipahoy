import Link from 'next/link';
import { Suspense } from 'react';

import { getAllClips, getCoveredPlaces } from '@/lib/archive';
import { getSubjectCounts, search } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { ClipGrid } from '@/components/ClipGrid';
import { SearchField } from '@/components/SearchField';

const SUGGESTIONS = ['monsoon', 'railway platform', 'Himalaya', 'street food', 'festival'];

export default function Home() {
  const clipCount = getAllClips().length;
  const covered = getCoveredPlaces(20);
  const subjects = getSubjectCounts();

  // A real result set, produced by the same engine a visitor drives — never a
  // mocked-up "featured" row.
  const featured = toCards(search('monsoon hills', 6).map((h) => h.clip));

  return (
    <main>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-line-soft">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(244,196,48,0.07),transparent_70%)]"
        />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
          <p className="eyebrow rise">The Wilderness Films archive</p>

          <h1
            className="rise mt-6 max-w-[18ch] font-display text-[2.75rem] leading-[1.04] font-light tracking-tight text-balance sm:text-6xl lg:text-7xl"
            style={{ animationDelay: '60ms' }}
          >
            Explore India on film.
          </h1>

          <p
            className="rise mt-6 max-w-xl text-[16px] leading-relaxed text-mute sm:text-[17px]"
            style={{ animationDelay: '110ms' }}
          >
            Decades of factual footage — railway platforms, wet markets, hill roads, the coast.
            Search {clipCount.toLocaleString()} clips, or start from a place.
          </p>

          <div className="rise mt-10 max-w-3xl" style={{ animationDelay: '160ms' }}>
            {/*
              No autoFocus: on a phone it force-opens the keyboard on arrival,
              hiding the page before the visitor has seen it. The field is
              large and unmissable, and "/" focuses it for keyboard users.
            */}
            <Suspense fallback={<div className="panel h-14 w-full rounded-sm sm:h-16" />}>
              <SearchField />
            </Suspense>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[13px] text-faint">Try</span>
              {SUGGESTIONS.map((s) => (
                <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">
                  {s}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- subjects */}
      <section className="mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8 sm:py-20">
        <SectionHead
          eyebrow="Browse by subject"
          title="What's in the archive"
          href="/subjects"
          linkLabel="All subjects"
        />

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {subjects.slice(0, 12).map(({ subject, count }) => (
            <li key={subject}>
              <Link
                href={`/subject/${encodeURIComponent(subject)}`}
                className="panel group flex h-full flex-col justify-between gap-6 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-faint"
              >
                <span className="font-display text-[17px] leading-tight text-paper capitalize transition-colors group-hover:text-accent">
                  {subject}
                </span>
                <span className="text-[12px] tabular-nums text-faint">
                  {count.toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------- featured */}
      {featured.length > 0 && (
        <section className="mx-auto w-full max-w-[1400px] px-5 pb-16 sm:px-8 sm:pb-20">
          <SectionHead
            eyebrow="From the archive"
            title="Monsoon in the hills"
            href="/search?q=monsoon+hills"
            linkLabel="More like this"
          />
          <div className="mt-8">
            <ClipGrid cards={featured} priorityCount={3} />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- places */}
      <section className="mx-auto w-full max-w-[1400px] px-5 pb-20 sm:px-8">
        <SectionHead
          eyebrow="Browse by place"
          title="Places we cover well"
          href="/places"
          linkLabel={`All ${covered.length} places`}
        />

        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mute">
          Towns and cities with the deepest coverage. There are more places than these — these are
          the ones with enough footage to be worth browsing.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {covered.slice(0, 18).map(({ place, clips }) => (
            <li key={place.id}>
              <Link
                href={`/place/${place.id}`}
                className="group flex items-baseline justify-between gap-4 border-b border-line-soft py-4 transition-colors hover:border-accent/40"
              >
                <span className="min-w-0">
                  <span className="font-display text-[19px] font-light text-paper transition-colors group-hover:text-accent">
                    {place.name}
                  </span>
                  <span className="ml-2 text-[12.5px] text-faint">
                    {place.country !== 'India' ? place.country : place.state}
                  </span>
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-faint">{clips}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function SectionHead({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-soft pb-5">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2.5 font-display text-[26px] leading-tight font-light sm:text-[32px]">
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="group inline-flex items-center gap-1.5 text-[14px] text-mute transition-colors hover:text-paper"
      >
        {linkLabel}
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        >
          →
        </span>
      </Link>
    </div>
  );
}

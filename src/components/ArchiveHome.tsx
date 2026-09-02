import Link from 'next/link';
import { Suspense } from 'react';

import { getCoveredPlaces, isIndianClip } from '@/lib/archive';
import { getSubjectCounts, search } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { coverForPlace, coverForSubject } from '@/lib/covers';
import { VideoGrid } from '@/components/VideoGrid';
import { Rail, SectionHead } from '@/components/Rail';
import { SearchField } from '@/components/SearchField';
import { CoverTile } from '@/components/Tiles';

const SUGGESTIONS = ['Bombay streets', 'Indian railways', 'Himalayas', 'monsoon', 'Kolkata tram'];

/** Fallback discovery rails for anyone who skipped the questions. */
const RAILS: { eyebrow: string; title: string; query: string }[] = [
  { eyebrow: 'Cities', title: 'Streets and crowds', query: 'street market crowd city' },
  { eyebrow: 'Transport', title: 'Rails, roads and rivers', query: 'railway train highway ferry' },
  { eyebrow: 'Wildlife', title: 'Creatures of the subcontinent', query: 'tiger elephant leopard bird' },
];

/* ------------------------------------------------------------------ stats */

/**
 * The four headline figures for the archive as a whole.
 *
 * These describe Wilderness Films' holdings, not what Clipahoy has indexed —
 * the indexed subset is smaller, and quoting it here ("108,148 clips") sold
 * the collection short. Figures are kept in step with the main website's
 * About page, which is the single source for them.
 */
const ARCHIVE_STATS = [
  { figure: '150,000+', label: 'Hours of video content' },
  { figure: '140,000+', label: 'Videos on YouTube' },
  { figure: '5 Million+', label: 'YouTube subscribers' },
  { figure: '37+', label: 'Years of experience' },
];

function ArchiveStats() {
  return (
    <ul className="rise mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line-soft bg-line-soft sm:grid-cols-4">
      {ARCHIVE_STATS.map((s) => (
        <li key={s.label} className="bg-ink px-4 py-5 sm:px-5">
          <p className="font-display text-[24px] leading-none font-light text-accent tabular-nums sm:text-[30px]">
            {s.figure}
          </p>
          <p className="mt-2 text-[12.5px] leading-snug text-faint">{s.label}</p>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- generic */

/** For anyone who skipped the questions, or whose answers matched too little. */
export function ArchiveHome({ thinPersonalisation = false }: { thinPersonalisation?: boolean }) {
  const covered = getCoveredPlaces(20);
  const subjects = getSubjectCounts();

  const seen = new Set<string>();
  const railData = RAILS.map((r) => {
    const clips = search(r.query, 60)
      .map((h) => h.clip)
      .filter((c) => !seen.has(c.id) && isIndianClip(c))
      .slice(0, 12);
    for (const c of clips) seen.add(c.id);
    return { ...r, cards: toCards(clips) };
  });

  const opening = toCards(
    search('street market railway temple hills', 40)
      .map((h) => h.clip)
      .filter((c) => isIndianClip(c))
      .slice(0, 8),
  );

  const usedCovers = new Set<string>();

  return (
    <main className="pb-16">
      <section className="shell pt-8 sm:pt-12">
        <div className="rise flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line-soft pb-7">
          <div className="min-w-0">
            <p className="eyebrow">The Wilderness Films archive</p>
            <h1 className="mt-2.5 font-display text-[34px] leading-none font-light tracking-[-0.02em] sm:text-[50px]">
              A virtual smorgasbord of India
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] text-mute">
              {thinPersonalisation
                ? 'We could not find enough in the archive to match what you told us, so this is the whole collection. Try again with a place or a subject.'
                : 'See every little bit of India’s colour, excitement and enchantment come alive on your screen. Curate your own India and share a virtual tour of your very own journey.'}
            </p>
          </div>

          <Link href="/start" className="btn btn-primary shrink-0">
            Make my archive
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ArchiveStats />

        <div className="rise mt-8 max-w-2xl" style={{ animationDelay: '60ms' }}>
          <Suspense fallback={<div className="panel h-14 w-full rounded-sm sm:h-16" />}>
            <SearchField />
          </Suspense>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {SUGGESTIONS.map((s) => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">
                {s}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <VideoGrid cards={opening} columns="dense" eagerCount={4} />
        </div>
      </section>

      <section className="shell section-major">
        <SectionHead
          eyebrow="Explore the archive"
          title="Browse by subject"
          href="/subjects"
          linkLabel={`All ${subjects.length}`}
        />
        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {subjects.slice(0, 12).map(({ subject, count }, i) => (
            <li key={subject} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <CoverTile
                href={`/subject/${encodeURIComponent(subject)}`}
                title={subject}
                meta={`${count.toLocaleString()} clips`}
                coverId={coverForSubject(subject, usedCovers)}
                capitalize
              />
            </li>
          ))}
        </ul>
      </section>

      {railData.map((r) => (
        <Rail
          key={r.title}
          cards={r.cards}
          eyebrow={r.eyebrow}
          title={r.title}
          href={`/search?q=${encodeURIComponent(r.query)}`}
          linkLabel="See all"
        />
      ))}

      <section className="shell section-minor">
        <SectionHead
          eyebrow="Browse by place"
          title="Where the cameras went"
          href="/places"
          linkLabel={`All ${covered.length} places`}
        />
        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {covered.slice(0, 10).map(({ place, clips }, i) => (
            <li key={place.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <CoverTile
                href={`/place/${place.id}`}
                title={place.name}
                meta={`${place.country !== 'India' ? place.country : place.state} · ${clips.toLocaleString()}`}
                coverId={coverForPlace(place.id, usedCovers)}
                ratio="aspect-[4/5]"
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

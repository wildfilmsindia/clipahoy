import Link from 'next/link';

import { getAllClips, getCoveredPlaces } from '@/lib/archive';
import { SearchBar } from '@/components/SearchBar';

/**
 * Landing page: a search bar and the places the archive actually covers.
 *
 * Deliberately NOT a personal-memory product. AUDIT.md's kill criteria failed
 * two of three for the hometown/nostalgia direction — only 115 places clear 20
 * usable clips, and there are no reliable filming dates — so the framing here
 * is exploring an archive, present tense, with no claim about the user's own
 * past and no "see it as it was".
 */
export default function Home() {
  const covered = getCoveredPlaces(20);
  const clipCount = getAllClips().length;

  return (
    <main className="px-6 pt-16 pb-24 sm:px-10">
      <section className="mx-auto w-full max-w-2xl lg:max-w-4xl">
        <p className="rise text-[11px] tracking-[0.18em] text-muted uppercase">
          The Wilderness Films archive
        </p>

        <h1
          className="rise mt-5 max-w-[16ch] font-display text-[2.6rem] leading-[1.06] font-light tracking-tight text-balance sm:text-6xl"
          style={{ animationDelay: '60ms' }}
        >
          Explore India on film.
        </h1>

        <p
          className="rise mt-6 max-w-lg text-[15px] leading-relaxed text-slate sm:text-base"
          style={{ animationDelay: '120ms' }}
        >
          Decades of footage of ordinary India — railway platforms, wet markets, hill roads, the
          coast. Search it, or start from a place.
        </p>

        <div className="rise mt-9 max-w-xl" style={{ animationDelay: '180ms' }}>
          <SearchBar />
        </div>

        <p className="rise mt-4 text-[12px] tabular-nums text-muted" style={{ animationDelay: '240ms' }}>
          {clipCount.toLocaleString()} clips · {covered.length} places · no account needed
        </p>
      </section>

      <section className="mx-auto mt-20 w-full max-w-2xl lg:max-w-4xl">
        <h2 className="text-[11px] tracking-[0.18em] text-muted uppercase">Places we cover well</h2>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-slate">
          These are the towns and cities with the deepest coverage in the archive. There are more
          places than this, but these are the ones with enough footage to be worth browsing.
        </p>

        <ul className="mt-8 grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {covered.slice(0, 48).map(({ place, clips }) => (
            <li key={place.id}>
              <Link
                href={`/place/${place.id}`}
                className="group flex items-baseline justify-between gap-3 border-b border-hairline/60 py-3 transition-colors hover:border-sodium/40"
              >
                <span className="font-display text-lg font-light transition-colors group-hover:text-sodium">
                  {place.name}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted">{clips}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

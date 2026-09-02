import Link from 'next/link';

import { getCoveredPlaces } from '@/lib/archive';
import { coverForPlace } from '@/lib/covers';
import { Thumbnail } from '@/components/Thumbnail';
import { SectionHead } from '@/components/Rail';

export const metadata = { title: 'Places' };

export default function PlacesPage() {
  const covered = getCoveredPlaces(20);

  const byCountry = new Map<string, typeof covered>();
  for (const entry of covered) {
    const key = entry.place.country || 'India';
    byCountry.set(key, [...(byCountry.get(key) ?? []), entry]);
  }
  const countries = [...byCountry.entries()].sort((a, b) =>
    a[0] === 'India' ? -1 : b[0] === 'India' ? 1 : b[1].length - a[1].length,
  );

  const usedCovers = new Set<string>();
  const featured = covered.slice(0, 8);

  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      <header className="rise rule-accent">
        <p className="eyebrow">Places</p>
        <h1 className="mt-2 font-display text-[34px] leading-tight font-light sm:text-[46px]">
          Where the cameras went
        </h1>
      </header>

      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {featured.map(({ place, clips }, i) => {
          const cover = coverForPlace(place.id, usedCovers);
          return (
            <li key={place.id} className="rise" style={{ animationDelay: `${i * 45}ms` }}>
              <Link
                href={`/place/${place.id}`}
                className="group relative block aspect-[16/10] overflow-hidden rounded-sm border border-line transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent/60"
              >
                {cover && (
                  <Thumbnail
                    videoId={cover}
                    eager={i < 4}
                    className="absolute inset-0 h-full w-full object-cover opacity-90 transition-[transform,opacity] duration-700 group-hover:scale-110 group-hover:opacity-100"
                  />
                )}
                {/* Matches the subject tiles: bottom-weighted only, image left bright. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/5 transition-colors duration-500 group-hover:from-forest group-hover:via-forest/45"
                />
                <span className="absolute inset-0 flex flex-col justify-end p-4">
                  <span className="font-display text-[20px] leading-tight text-paper transition-colors group-hover:text-accent">
                    {place.name}
                  </span>
                  <span className="mt-1 text-[12px] text-mute">
                    {place.country !== 'India' ? place.country : place.state} ·{' '}
                    <span className="tabular-nums">{clips}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {countries.map(([country, places]) => (
        <section key={country} className="mt-14">
          <SectionHead eyebrow={`${places.length} places`} title={country} />
          <ul className="mt-6 grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {places.map(({ place, clips }) => (
              <li key={place.id}>
                <Link
                  href={`/place/${place.id}`}
                  className="group flex items-baseline justify-between gap-3 border-b border-line-soft py-3 transition-colors hover:border-accent/50"
                >
                  <span className="min-w-0 truncate font-display text-[16px] font-light text-paper transition-colors group-hover:text-accent">
                    {place.name}
                  </span>
                  <span className="shrink-0 text-[12px] tabular-nums text-faint">{clips}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

import Link from 'next/link';

import { getCoveredPlaces } from '@/lib/archive';

export const metadata = { title: 'Places' };

export default function PlacesPage() {
  const covered = getCoveredPlaces(20);

  // Group by country so the non-India material is visible as a real section
  // rather than scattered through an alphabetical wall.
  const byCountry = new Map<string, typeof covered>();
  for (const entry of covered) {
    const key = entry.place.country || 'India';
    byCountry.set(key, [...(byCountry.get(key) ?? []), entry]);
  }
  const countries = [...byCountry.entries()].sort(
    (a, b) => (a[0] === 'India' ? -1 : b[0] === 'India' ? 1 : b[1].length - a[1].length),
  );

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
      <header className="border-b border-line-soft pb-6">
        <p className="eyebrow">Browse</p>
        <h1 className="mt-2.5 font-display text-[28px] leading-tight font-light sm:text-[36px]">
          Places
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute">
          {covered.length} towns and cities with at least 20 well-described clips. The archive names
          more places than these, but these are the ones deep enough to browse.
        </p>
      </header>

      {countries.map(([country, places]) => (
        <section key={country} className="mt-12">
          <h2 className="eyebrow border-b border-line-soft pb-3">
            {country} · {places.length}
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {places.map(({ place, clips }) => (
              <li key={place.id}>
                <Link
                  href={`/place/${place.id}`}
                  className="group flex items-baseline justify-between gap-4 border-b border-line-soft py-3.5 transition-colors hover:border-accent/40"
                >
                  <span className="min-w-0">
                    <span className="font-display text-[18px] font-light text-paper transition-colors group-hover:text-accent">
                      {place.name}
                    </span>
                    {place.state !== place.name && (
                      <span className="ml-2 text-[12.5px] text-faint">{place.state}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[12.5px] tabular-nums text-faint">{clips}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

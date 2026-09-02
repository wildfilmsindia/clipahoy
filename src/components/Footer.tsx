import Link from 'next/link';


export function Footer() {
  return (
    <footer className="mt-24 border-t border-line-soft">
      <div className="shell py-14">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-[19px] text-paper">Clipahoy</p>
            <p className="mt-3 text-[14px] leading-relaxed text-mute">
              A searchable front door to South Asia&rsquo;s largest factual visual archive —
              decades of content filmed across India and her neighbours.
            </p>
            <p className="mt-4 text-[13px] text-faint">Showcasing India at her best.</p>
          </div>

          <nav aria-label="Footer" className="flex gap-14">
            <div>
              <p className="eyebrow">Browse</p>
              <ul className="mt-4 space-y-2.5">
                {[
                  { href: '/subjects', label: 'Subjects' },
                  { href: '/places', label: 'Places' },
                  /* A bare "Monsoon" sat here beside two section names and read
                     as a third section rather than as a saved search. */
                  { href: '/search', label: 'Search' },
                ].map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-[14px] text-mute transition-colors hover:text-paper"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow">Archive</p>
              <ul className="mt-4 space-y-2.5">
                {/* Licensing now has a page here, so it no longer sends
                    people off-site mid-task; the form reaches the same inbox. */}
                {[
                  { href: '/about', label: 'About us' },
                  { href: '/contact', label: 'Contact' },
                  { href: '/contact', label: 'License footage' },
                ].map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[14px] text-mute transition-colors hover:text-paper"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a
                    href="https://www.wildfilmsindia.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[14px] text-mute transition-colors hover:text-paper"
                  >
                    Wilderness Films
                    {/* Marks the one link that leaves the site. */}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 12 12"
                      className="h-2.5 w-2.5 opacity-60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    >
                      <path d="M4.5 2h5.5v5.5M10 2 4 8" />
                      <path d="M8 9.5v.5H2V4h.5" />
                    </svg>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <p className="mt-12 border-t border-line-soft pt-6 text-[12.5px] text-faint">
          Footage © Wilderness Films India Ltd. Videos are hosted on YouTube and play from there.
        </p>
      </div>
    </footer>
  );
}

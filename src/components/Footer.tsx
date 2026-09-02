import Link from 'next/link';


export function Footer() {
  return (
    <footer className="mt-24 border-t border-line-soft">
      <div className="shell py-14">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-[19px] text-paper">
              Clip<span className="text-accent">ahoy</span>
              <span className="ml-1.5 text-[13px] font-sans font-normal text-mute">by WildFilmsIndia</span>
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-mute">
              A searchable front door to South Asia&rsquo;s largest factual visual archive —
              decades of content filmed across India and her neighbours.
            </p>

            <div className="mt-4 flex items-center gap-4">
              <a href="https://www.youtube.com/@WildFilmsIndia" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="text-faint transition-colors hover:text-paper">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z"/></svg>
              </a>
              <a href="https://www.instagram.com/wildfilmsindia/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-faint transition-colors hover:text-paper">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z"/></svg>
              </a>
              <a href="https://x.com/wildfilmsindia" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="text-faint transition-colors hover:text-paper">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
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
                {[
                  { href: 'https://www.wildfilmsindia.com/about', label: 'About us' },
                  { href: 'https://www.wildfilmsindia.com/contact', label: 'Contact' },
                  { href: 'https://www.wildfilmsindia.com/contact', label: 'License footage' },
                  { href: 'https://www.wildfilmsindia.com', label: 'Wilderness Films' },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[14px] text-mute transition-colors hover:text-paper"
                    >
                      {l.label}
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
                ))}
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

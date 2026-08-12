import Link from 'next/link';

const LICENSE_URL = 'https://www.wildfilmsindia.com/contact';

export function Footer({ clips, places }: { clips: number; places: number }) {
  return (
    <footer className="mt-24 border-t border-line-soft">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-[19px] text-paper">Clipahoy</p>
            <p className="mt-3 text-[14px] leading-relaxed text-mute">
              A searchable front door to the Wilderness Films India archive — decades of factual
              footage of ordinary India and its neighbours.
            </p>
            <p className="mt-4 text-[13px] tabular-nums text-faint">
              {clips.toLocaleString()} clips · {places} places covered
            </p>
          </div>

          <nav aria-label="Footer" className="flex gap-14">
            <div>
              <p className="eyebrow">Browse</p>
              <ul className="mt-4 space-y-2.5">
                {[
                  { href: '/subjects', label: 'Subjects' },
                  { href: '/places', label: 'Places' },
                  { href: '/search?q=monsoon', label: 'Monsoon' },
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
                <li>
                  <a
                    href={LICENSE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-mute transition-colors hover:text-paper"
                  >
                    License footage
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.wildfilmsindia.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-mute transition-colors hover:text-paper"
                  >
                    Wilderness Films
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

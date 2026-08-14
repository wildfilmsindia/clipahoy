'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { SearchField } from './SearchField';

/*
 * Only routes that exist. An "Explore" entry was pointing at /subjects
 * alongside a Subjects entry, which labelled one destination twice.
 */
const NAV = [
  { href: '/subjects', label: 'Subjects' },
  { href: '/places', label: 'Places' },
  { href: '/search', label: 'Search' },
];

/**
 * Persistent header.
 *
 * Previously every page hand-rolled its own "CLIPAHOY" text link and there was
 * no navigation at all, so the two browse axes (subject, place) were
 * unreachable except from the homepage.
 *
 * The compact search field is hidden on `/` because the homepage already leads
 * with a large one — showing both would state the primary action twice.
 */
export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  /*
   * The compact search is hidden on the homepage (which leads with a large
   * one) and on /start, where a search box beside a full-screen questionnaire
   * offers a competing way out of a flow the person just chose to begin.
   */
  const isHome = pathname === '/' || pathname === '/start';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? 'glass border-line/80'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-5 sm:gap-6 sm:px-8">
        <Link
          href="/"
          className="group shrink-0 font-display text-[20px] leading-none tracking-tight text-paper transition-colors hover:text-accent"
        >
          Clip<span className="text-accent transition-colors group-hover:text-paper">ahoy</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {/*
            Personalisation is a destination, not a setting, so it leads the
            nav. The label doubles as the call to action before anyone has
            answered the questions.
          */}
          {/*
            Both states ship in the HTML; the inline script in layout.tsx marks
            <html data-taste> before paint and CSS reveals the right one. That
            keeps this route static and still shows the correct label on the
            first frame.
          */}
          <Link
            href="/"
            data-taste-on
            className="relative rounded-xs px-3 py-2 text-[14px] text-paper transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-px after:bg-accent"
          >
            My Archive
          </Link>
          <Link
            href="/start"
            data-taste-off
            className="relative rounded-xs px-3 py-2 text-[14px] text-accent transition-colors hover:text-accent-soft"
          >
            Make my archive
          </Link>

          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-xs px-3 py-2 text-[14px] transition-colors ${
                  active ? 'text-paper' : 'text-mute hover:text-paper'
                } after:absolute after:inset-x-3 after:-bottom-0.5 after:h-px after:origin-left after:bg-accent after:transition-transform after:duration-300 ${
                  active ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3">
          {!isHome && (
            <div className="w-full max-w-md">
              {/*
                SearchField calls useSearchParams, which opts its subtree out of
                prerendering. Boundary sits here rather than around the whole
                header in layout.tsx — with it further out, the entire nav was
                excluded from the static HTML of /subjects and /places and only
                appeared after hydration.
              */}
              <Suspense fallback={<div className="h-10 rounded-sm border border-line" />}>
                <SearchField compact />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav: the two browse axes stay reachable without a menu. */}
      <nav
        aria-label="Primary mobile"
        className="flex items-center gap-1 overflow-x-auto border-t border-line-soft/60 px-5 py-2 sm:hidden"
      >
        <Link
          href="/"
          data-taste-on
          className="shrink-0 rounded-xs px-3 py-1.5 text-[13px] whitespace-nowrap text-paper transition-colors"
        >
          My Archive
        </Link>
        <Link
          href="/start"
          data-taste-off
          className="shrink-0 rounded-xs px-3 py-1.5 text-[13px] whitespace-nowrap text-accent transition-colors"
        >
          Make my archive
        </Link>

        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-xs px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
                active ? 'text-paper' : 'text-mute'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

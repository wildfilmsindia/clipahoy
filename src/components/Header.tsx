'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SearchField } from './SearchField';

const NAV = [
  { href: '/subjects', label: 'Subjects' },
  { href: '/places', label: 'Places' },
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
  const isHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300 ${
        scrolled
          ? 'border-line bg-ink/85 backdrop-blur-md supports-[backdrop-filter]:bg-ink/70'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-4 px-5 sm:gap-6 sm:px-8">
        <Link
          href="/"
          className="shrink-0 font-display text-[19px] leading-none tracking-tight text-paper transition-colors hover:text-accent"
        >
          Clipahoy
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-xs px-3 py-2 text-[14px] transition-colors ${
                  active ? 'text-paper' : 'text-mute hover:text-paper'
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
              <SearchField compact />
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav: the two browse axes stay reachable without a menu. */}
      <nav
        aria-label="Primary mobile"
        className="flex items-center gap-1 border-t border-line-soft px-5 py-2 sm:hidden"
      >
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-xs px-3 py-1.5 text-[13px] transition-colors ${
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

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The archive's primary control.
 *
 * Two sizes from one component so the header and the homepage hero cannot
 * drift apart. Submits to /search, which ranks server-side with BM25 — there
 * is no client-side matching.
 */
export function SearchField({
  compact = false,
  autoFocus = false,
}: {
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const params = useSearchParams();
  const urlQuery = params.get('q') ?? '';

  const [q, setQ] = useState(urlQuery);
  const [syncedTo, setSyncedTo] = useState(urlQuery);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  /*
   * Keep the field in step with the URL when navigating between results.
   *
   * Adjusted during render against a previous-value guard rather than in an
   * effect: an effect would render once with the stale query, then again with
   * the new one, which is the cascading-render pattern React warns about.
   */
  if (urlQuery !== syncedTo) {
    setSyncedTo(urlQuery);
    setQ(urlQuery);
    setPending(false);
  }

  // "/" focuses search from anywhere, the convention for search-led products.
  useEffect(() => {
    if (compact) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    setPending(true);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const id = compact ? 'search-compact' : 'search-main';

  return (
    <form onSubmit={submit} role="search" className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Search the archive
      </label>

      <SearchIcon
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-faint ${
          compact ? 'left-3 h-4 w-4' : 'left-4 h-[18px] w-[18px]'
        }`}
      />

      <input
        id={id}
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        enterKeyHint="search"
        /*
         * Short placeholder. The longer "…— monsoon, railway platform, the
         * coast" version was clipped by the submit button at 390px, and the
         * examples are already offered as tappable chips below the field.
         */
        placeholder={compact ? 'Search' : 'Search the archive'}
        className={`panel w-full text-paper outline-none transition-[border-color,background-color] duration-200 placeholder:text-faint focus:border-accent/60 ${
          compact
            ? 'h-10 rounded-sm pr-3 pl-9 text-[14px]'
            : 'h-14 rounded-sm pr-28 pl-12 text-[16px] sm:h-16 sm:text-[17px]'
        }`}
      />

      {!compact && (
        <button
          type="submit"
          className="btn btn-primary absolute top-1/2 right-2 -translate-y-1/2 px-5 py-2.5"
        >
          {pending ? 'Searching' : 'Search'}
        </button>
      )}

      {/* Progress hairline: the only feedback during a server round-trip. */}
      <span
        aria-hidden="true"
        className={`absolute right-0 -bottom-px left-0 h-px origin-left bg-accent transition-transform duration-500 ${
          pending ? 'scale-x-100' : 'scale-x-0'
        }`}
      />
    </form>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Free-text entry. Submits to /search, which does the BM25 ranking
 * server-side — there is no client-side matching and no LLM step.
 */
export function SearchBar({
  initial = '',
  autoFocus = false,
}: {
  initial?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState(initial);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full gap-2">
      {/* A real label, visually hidden. A placeholder alone is not an
          accessible name — it vanishes once the field has content. */}
      <label htmlFor="archive-search" className="sr-only">
        Search the archive
      </label>
      <input
        id="archive-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="monsoon rain, a railway platform, the coast…"
        className="min-w-0 flex-1 rounded border border-hairline bg-raised px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-muted focus:border-sodium/60"
      />
      <button
        type="submit"
        className="lamp shrink-0 cursor-pointer rounded bg-sodium px-6 py-3 text-[15px] font-medium text-ground transition-transform duration-200 hover:-translate-y-px active:translate-y-0"
      >
        Search
      </button>
    </form>
  );
}

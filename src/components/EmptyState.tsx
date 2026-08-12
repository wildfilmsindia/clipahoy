import Link from 'next/link';

/**
 * The honest no-results surface.
 *
 * An empty grid or a silent fallback to unrelated clips both read as broken.
 * This says plainly that nothing matched and offers a way onward, per the
 * archive's rule that empty states are invitations, not apologies.
 */
export function EmptyState({
  title,
  body,
  suggestions,
}: {
  title: string;
  body: string;
  suggestions?: string[];
}) {
  return (
    <div className="rise mx-auto max-w-xl py-20 text-center sm:py-28">
      <div
        aria-hidden="true"
        className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-line bg-surface"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-faint">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <h2 className="mt-6 font-display text-[24px] leading-tight font-light text-paper">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mute">{body}</p>

      {suggestions && suggestions.length > 0 && (
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">
              {s}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

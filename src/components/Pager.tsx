import Link from 'next/link';

/**
 * Prev/next paging.
 *
 * Results were previously capped at 60 with no way past them, so most of a
 * large result set was unreachable. Links rather than a client "load more" so
 * every page is addressable, shareable and crawlable.
 */
export function Pager({
  page,
  lastPage,
  href,
}: {
  page: number;
  lastPage: number;
  href: (page: number) => string;
}) {
  if (lastPage <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < lastPage;

  return (
    <nav
      aria-label="Pagination"
      className="mt-14 flex items-center justify-between gap-4 border-t border-line-soft pt-8"
    >
      {hasPrev ? (
        <Link href={href(page - 1)} className="btn btn-ghost group">
          <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
            ←
          </span>
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}

      <p className="text-[13px] tabular-nums text-faint">
        {page} / {lastPage}
      </p>

      {hasNext ? (
        <Link href={href(page + 1)} className="btn btn-ghost group">
          Next
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
}

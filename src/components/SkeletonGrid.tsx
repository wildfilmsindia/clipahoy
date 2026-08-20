/**
 * Result-shaped loading state.
 *
 * Search runs server-side, so a slow query would otherwise show a blank page.
 * Geometry matches VideoCard exactly so nothing jumps when results land —
 * including the column counts, which have to be kept in step with VideoGrid's
 * `default` set or the grid reflows the moment the real cards arrive.
 */
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="shimmer aspect-video rounded-sm border border-line" />
          <div className="shimmer mt-3 h-4 w-[88%] rounded-xs" />
          <div className="shimmer mt-2 h-3 w-[40%] rounded-xs" />
        </li>
      ))}
    </ul>
  );
}

/**
 * A playlist row's worth of placeholders.
 *
 * Uses the same `.playlist-row` class as the real thing, so it is a swipeable
 * rail on a phone and a row of five on a desktop — a skeleton that changes
 * shape at a breakpoint is worse than none.
 */
export function SkeletonRow({ count = 5 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="playlist-row">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="shimmer aspect-video rounded-sm border border-line" />
          <div className="shimmer mt-3 h-4 w-[88%] rounded-xs" />
          <div className="shimmer mt-2 h-3 w-[40%] rounded-xs" />
        </li>
      ))}
    </ul>
  );
}

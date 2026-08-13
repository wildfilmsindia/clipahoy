/**
 * Result-shaped loading state.
 *
 * Search runs server-side, so a slow query would otherwise show a blank page.
 * Geometry matches VideoCard exactly so nothing jumps when results land.
 */
export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
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

/**
 * Result-shaped loading state.
 *
 * Search runs server-side, so a slow query previously showed a blank page.
 * These placeholders match the real card geometry, so the layout does not jump
 * when results arrive.
 */
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="shimmer aspect-video rounded-sm border border-line" />
          <div className="shimmer mt-3.5 h-4 w-[85%] rounded-xs" />
          <div className="shimmer mt-2 h-3 w-[45%] rounded-xs" />
        </li>
      ))}
    </ul>
  );
}

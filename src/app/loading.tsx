import { SkeletonRow } from '@/components/SkeletonGrid';

/**
 * The personalised feed is the slowest page on the site — it runs a search per
 * answer — and it had no loading state, so a visitor watched a blank screen for
 * over a second after finishing the questions. Mirrors the real masthead and
 * the first three playlist rows so nothing shifts when the feed lands.
 */
export default function Loading() {
  return (
    <main className="pb-16">
      <section className="shell pt-8 sm:pt-12">
        <div className="border-b border-line-soft pb-7">
          <p className="eyebrow">Your archive</p>
          <div className="shimmer mt-3 h-12 w-64 rounded-xs sm:h-14" />
          <div className="shimmer mt-4 h-4 w-[min(28rem,80%)] rounded-xs" />
          <div className="shimmer mt-3 h-3 w-40 rounded-xs" />
        </div>
      </section>

      {Array.from({ length: 3 }).map((_, i) => (
        <section key={i} className="shell section-major">
          <div className="border-l-2 border-accent/30 pl-4">
            <div className="shimmer h-3 w-44 rounded-xs" />
            <div className="shimmer mt-2.5 h-8 w-40 rounded-xs" />
          </div>
          <div className="mt-6">
            <SkeletonRow />
          </div>
        </section>
      ))}

      <span className="sr-only" role="status">
        Building your archive
      </span>
    </main>
  );
}

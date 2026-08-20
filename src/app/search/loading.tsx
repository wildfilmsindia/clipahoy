import { SkeletonGrid } from '@/components/SkeletonGrid';

export default function Loading() {
  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      <p className="eyebrow">Search results</p>
      <div className="shimmer mt-3 h-10 w-72 rounded-xs" />
      <div className="mt-7 flex gap-2 border-y border-line-soft py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="shimmer h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-9">
        <SkeletonGrid count={8} />
      </div>
      <span className="sr-only" role="status">Loading results</span>
    </main>
  );
}

import { SkeletonGrid } from '@/components/SkeletonGrid';

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
      <div className="border-b border-line-soft pb-6">
        <p className="eyebrow">Search</p>
        <div className="shimmer mt-3 h-9 w-64 rounded-xs" />
      </div>
      <div className="mt-10">
        <SkeletonGrid count={6} />
      </div>
      <span className="sr-only" role="status">Loading results</span>
    </main>
  );
}

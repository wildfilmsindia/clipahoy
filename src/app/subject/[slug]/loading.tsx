import { SkeletonGrid } from '@/components/SkeletonGrid';

export default function Loading() {
  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      <div className="shimmer h-3 w-32 rounded-xs" />
      <div className="shimmer mt-3 h-12 w-72 rounded-xs sm:h-14" />
      <div className="shimmer mt-4 h-4 w-[min(30rem,85%)] rounded-xs" />
      <div className="mt-9">
        <SkeletonGrid count={8} />
      </div>
      <span className="sr-only" role="status">Loading footage</span>
    </main>
  );
}

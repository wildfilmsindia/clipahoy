'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col items-center px-5 py-28 text-center sm:px-8 sm:py-36">
      <p className="eyebrow">Something broke</p>
      <h1 className="mt-4 font-display text-[32px] leading-tight font-light sm:text-[42px]">
        That didn&rsquo;t load.
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">
        The archive is served from a single index; if it was mid-rebuild this usually clears on a
        retry.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
        <Link href="/" className="btn btn-ghost">Go home</Link>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-[12px] text-faint">Reference: {error.digest}</p>
      )}
    </main>
  );
}

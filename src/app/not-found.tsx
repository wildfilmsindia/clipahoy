import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col items-center px-5 py-28 text-center sm:px-8 sm:py-36">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 font-display text-[32px] leading-tight font-light sm:text-[42px]">
        That page isn&rsquo;t here.
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">
        The clip, place or subject you asked for isn&rsquo;t in the archive. It may never have been,
        or the address may be mistyped.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">Back to search</Link>
        <Link href="/subjects" className="btn btn-ghost">Browse subjects</Link>
      </div>
    </main>
  );
}

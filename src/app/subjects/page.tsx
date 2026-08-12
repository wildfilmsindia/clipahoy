import Link from 'next/link';

import { getSubjectCounts } from '@/lib/search';

export const metadata = { title: 'Subjects' };

export default function SubjectsPage() {
  const subjects = getSubjectCounts();
  const total = subjects.reduce((n, s) => n + s.count, 0);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
      <header className="border-b border-line-soft pb-6">
        <p className="eyebrow">Browse</p>
        <h1 className="mt-2.5 font-display text-[28px] leading-tight font-light sm:text-[36px]">
          Subjects
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-mute">
          Every clip is tagged against a closed vocabulary of {subjects.length} subjects, describing
          what the camera saw. {total.toLocaleString()} tags across the archive.
        </p>
      </header>

      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {subjects.map(({ subject, count }, i) => (
          <li key={subject} className="rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <Link
              href={`/subject/${encodeURIComponent(subject)}`}
              className="panel group flex h-full items-baseline justify-between gap-4 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-faint"
            >
              <span className="font-display text-[18px] leading-tight text-paper capitalize transition-colors group-hover:text-accent">
                {subject}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-faint">
                {count.toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

import Link from 'next/link';

import { getSubjectCounts } from '@/lib/search';
import { coverForSubject } from '@/lib/covers';
import { Thumbnail } from '@/components/Thumbnail';

export const metadata = { title: 'Explore' };

export default function SubjectsPage() {
  const subjects = getSubjectCounts();
  const total = subjects.reduce((n, s) => n + s.count, 0);

  const used = new Set<string>();
  const covers = new Map<string, string | undefined>();
  for (const { subject } of subjects) covers.set(subject, coverForSubject(subject, used));

  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      <header className="rise rule-accent">
        <p className="eyebrow">Explore</p>
        <h1 className="mt-2 font-display text-[34px] leading-tight font-light sm:text-[46px]">
          Every subject in the archive
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mute">
          Each clip is tagged against a closed vocabulary of {subjects.length} subjects describing
          what the camera saw — {total.toLocaleString()} tags in total.
        </p>
      </header>

      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {subjects.map(({ subject, count }, i) => {
          const cover = covers.get(subject);
          return (
            <li key={subject} className="rise" style={{ animationDelay: `${Math.min(i, 14) * 35}ms` }}>
              <Link
                href={`/subject/${encodeURIComponent(subject)}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-sm border border-line transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent/60"
              >
                {cover && (
                  <Thumbnail
                    videoId={cover}
                    eager={i < 10}
                    className="absolute inset-0 h-full w-full object-cover opacity-90 transition-[transform,opacity] duration-700 group-hover:scale-110 group-hover:opacity-100"
                  />
                )}
                {/* Bottom-weighted only: dimming the image and covering it with
                    a full-height scrim turned every tile into a black box. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/5 transition-colors duration-500 group-hover:from-forest group-hover:via-forest/45"
                />
                <span className="absolute inset-0 flex flex-col justify-end p-4">
                  <span className="font-display text-[19px] leading-tight text-paper capitalize transition-colors group-hover:text-accent">
                    {subject}
                  </span>
                  <span className="mt-1 text-[12px] tabular-nums text-mute">
                    {count.toLocaleString()} clips
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

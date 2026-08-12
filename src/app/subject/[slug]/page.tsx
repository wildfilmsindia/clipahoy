import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SUBJECTS, type Subject } from '@/lib/types';
import { clipsForSubject, getSubjectCounts } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { ClipGrid } from '@/components/ClipGrid';
import { Pager } from '@/components/Pager';

const PAGE_SIZE = 24;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

function resolve(slug: string): Subject | null {
  const decoded = decodeURIComponent(slug).toLowerCase();
  return (SUBJECTS as readonly string[]).includes(decoded) ? (decoded as Subject) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const subject = resolve(slug);
  if (!subject) return { title: 'Subject not found' };
  return {
    title: subject.charAt(0).toUpperCase() + subject.slice(1),
    description: `Archive footage tagged ${subject}, from the Wilderness Films archive.`,
  };
}

export default async function SubjectPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const subject = resolve(slug);
  if (!subject) notFound();

  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { clips, total } = clipsForSubject(subject, (page - 1) * PAGE_SIZE, PAGE_SIZE);
  const cards = toCards(clips);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const others = getSubjectCounts()
    .filter((s) => s.subject !== subject)
    .slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
      <header className="border-b border-line-soft pb-6">
        <nav aria-label="Breadcrumb" className="mb-3">
          <Link href="/subjects" className="text-[13px] text-faint transition-colors hover:text-mute">
            Subjects
          </Link>
        </nav>
        <h1 className="font-display text-[28px] leading-tight font-light capitalize sm:text-[36px]">
          {subject}
        </h1>
        <p className="mt-3 text-[14px] text-mute">
          {total.toLocaleString()} {total === 1 ? 'clip' : 'clips'}
          {lastPage > 1 && (
            <span className="text-faint">
              {' '}
              · page {page} of {lastPage}
            </span>
          )}
        </p>
      </header>

      <div className="mt-10">
        <ClipGrid cards={cards} />
      </div>

      <Pager
        page={page}
        lastPage={lastPage}
        href={(p) => `/subject/${encodeURIComponent(subject)}?page=${p}`}
      />

      <section className="mt-16 border-t border-line-soft pt-8">
        <p className="eyebrow">Other subjects</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {others.map(({ subject: s, count }) => (
            <li key={s}>
              <Link href={`/subject/${encodeURIComponent(s)}`} className="chip capitalize">
                {s}
                <span className="tabular-nums text-faint">{count.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

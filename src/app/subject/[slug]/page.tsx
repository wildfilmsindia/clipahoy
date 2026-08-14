import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SUBJECTS, type Subject } from '@/lib/types';
import { clipsForSubject, getSubjectCounts } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { VideoCard } from '@/components/VideoCard';
import { VideoGrid } from '@/components/VideoGrid';
import { Pager } from '@/components/Pager';
import { Thumbnail } from '@/components/Thumbnail';

const PAGE_SIZE = 23; // 23 + 1 hero = 24 per page

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
  const offset = page === 1 ? 0 : 1 + (page - 1) * PAGE_SIZE;
  const { clips, total } = clipsForSubject(subject, offset, page === 1 ? PAGE_SIZE + 1 : PAGE_SIZE);
  const cards = toCards(clips); // already India-first: see clipsForSubject

  const hero = page === 1 ? cards[0] : undefined;
  const rest = page === 1 ? cards.slice(1) : cards;
  const lastPage = Math.max(1, Math.ceil((total - 1) / PAGE_SIZE));

  const others = getSubjectCounts().filter((s) => s.subject !== subject).slice(0, 12);

  return (
    <main>
      {/* Banner built from a real clip in this subject. */}
      <header className="relative overflow-hidden border-b border-line-soft">
        {hero && (
          <>
            <Thumbnail
              videoId={hero.clip.id}
              eager
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/50" />
          </>
        )}
        <div className="relative mx-auto w-full max-w-[1600px] px-5 py-14 sm:px-8 sm:py-20">
          <nav aria-label="Breadcrumb">
            <Link href="/subjects" className="text-[13px] text-faint transition-colors hover:text-accent">
              Explore
            </Link>
          </nav>
          <h1 className="rise mt-3 font-display text-[38px] leading-none font-light capitalize sm:text-[58px]">
            {subject}
          </h1>
          <p className="rise mt-4 text-[15px] text-mute" style={{ animationDelay: '60ms' }}>
            <span className="text-paper tabular-nums">{total.toLocaleString()}</span> clips
            {lastPage > 1 && <span className="text-faint"> · page {page} of {lastPage}</span>}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-5 py-12 sm:px-8">
        {hero && (
          <div className="mb-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <VideoCard data={hero} size="large" eager index={0} />
            <ul className="hidden space-y-4 lg:block">
              {rest.slice(0, 4).map((c, i) => (
                <li key={c.clip.id}><VideoCard data={c} size="row" index={i} /></li>
              ))}
            </ul>
          </div>
        )}

        <VideoGrid cards={hero ? rest.slice(4) : rest} eagerCount={0} />

        <Pager
          page={page}
          lastPage={lastPage}
          href={(p) => `/subject/${encodeURIComponent(subject)}${p > 1 ? `?page=${p}` : ''}`}
        />

        <section className="mt-16 border-t border-line-soft pt-8">
          <p className="eyebrow">Related subjects</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map(({ subject: s, count }) => (
              <li key={s}>
                <Link href={`/subject/${encodeURIComponent(s)}`} className="chip capitalize">
                  {s}
                  <span className="tabular-nums opacity-60">{count.toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

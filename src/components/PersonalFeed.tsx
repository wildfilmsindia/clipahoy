import Link from 'next/link';

import { getPlace } from '@/lib/archive';
import { toCards } from '@/lib/cards';
import { coverForPlace, coverForSubject } from '@/lib/covers';
import { summarise, type Recommendation } from '@/lib/recommend';
import { VideoGrid } from '@/components/VideoGrid';
import { SectionHead } from '@/components/Rail';
import { CoverTile } from '@/components/Tiles';
import { ShareButton } from '@/components/ShareButton';

/**
 * The curated feed: one playlist per answer, in the order the questions were
 * asked.
 *
 * Lives here rather than in `page.tsx` because a shared link renders exactly
 * the same thing for someone else. The feed is a pure function of the answers,
 * so the only differences between the two views are the masthead wording and
 * which call to action sits beside it — everything below is identical, which is
 * the point of sharing it at all.
 */

/*
 * Only the weaker evidence is labelled.
 *
 * A title match is the strongest signal this archive offers and is by far the
 * common case — badging every card with "in the title" would put the same words
 * on thirty cards and say nothing. Silence means the answer is in the title; a
 * badge means it qualified some other way and is worth a second look.
 */
const WEAKER_EVIDENCE: Record<string, string> = {
  place: 'filmed here',
  subject: 'tagged subject',
  text: 'from the description',
};

export function PersonalFeed({
  rec,
  /** Present when this is somebody else's curated India, opened from a link. */
  shareUrl,
  shared = false,
}: {
  rec: Recommendation;
  shareUrl?: string;
  shared?: boolean;
}) {
  const summary = summarise(rec);

  const usedCovers = new Set<string>();
  const placeRows = rec.places.map(({ placeId, clips }) => ({
    place: getPlace(placeId),
    clips,
    cover: coverForPlace(placeId, usedCovers),
  }));
  const subjectRows = rec.subjects.map(({ subject, count }) => ({
    subject,
    count,
    cover: coverForSubject(subject, usedCovers),
  }));

  const totalClips = rec.groups.reduce((n, g) => n + g.clips.length, 0);

  return (
    <main className="pb-16">
      {/* ======================================================== MASTHEAD */}
      <section className="shell pt-8 sm:pt-12">
        <div className="rise flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line-soft pb-7">
          <div className="min-w-0">
            <p className="eyebrow">{shared ? 'A shared journey' : 'Your archive'}</p>
            <h1 className="mt-2.5 font-display text-[38px] leading-none font-light tracking-[-0.02em] sm:text-[56px]">
              {shared ? 'Their India' : 'Your India'}
            </h1>
            {summary && <p className="mt-4 max-w-2xl text-[15px] text-mute">{summary}</p>}
            <p className="mt-2 text-[13px] text-faint tabular-nums">
              {totalClips} clip{totalClips === 1 ? '' : 's'} across {rec.groups.length}{' '}
              {rec.groups.length === 1 ? 'answer' : 'answers'}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {shareUrl && <ShareButton url={shareUrl} />}
            <Link href="/start" className={shared ? 'btn btn-primary' : 'btn btn-ghost'}>
              {shared ? 'Curate your own India' : 'Curate your India'}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/*
        One playlist per answer. Capped at five so the page stays a set of
        deliberate short rows rather than an endless feed, and nothing appears
        that cannot be traced to something the visitor typed.
      */}
      {rec.groups.map((group, i) => {
        const cards = toCards(
          group.clips,
          group.reasons.map((r) => WEAKER_EVIDENCE[r] ?? ''),
        );
        return (
          <section key={group.questionId} className="shell section-major">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-l-2 border-accent pl-4">
              <div className="min-w-0">
                <p className="eyebrow">{group.prompt}</p>
                <h2 className="mt-1.5 font-display text-[26px] leading-tight font-light capitalize sm:text-[34px]">
                  {group.answer}
                </h2>
              </div>
              <Link
                href={`/search?q=${encodeURIComponent(group.answer)}`}
                className="shrink-0 text-[13px] text-mute underline decoration-line underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
              >
                {group.hasMore ? 'More like this' : 'Search this'} →
              </Link>
            </div>

            <div className="mt-6">
              <VideoGrid cards={cards} columns="playlist" eagerCount={i === 0 ? 5 : 0} />
            </div>
          </section>
        );
      })}

      {/* ========================================================== PLACES */}
      {placeRows.length > 0 && (
        <section className="shell section-major">
          <SectionHead
            eyebrow="Browse by place"
            title={shared ? 'Places in this archive' : 'Places in your archive'}
            href="/places"
            linkLabel="All places"
          />
          <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {placeRows.map(
              ({ place, clips, cover }, i) =>
                place && (
                  <li
                    key={place.id}
                    className="rise"
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    <CoverTile
                      href={`/place/${place.id}`}
                      title={place.name}
                      meta={`${place.country !== 'India' ? place.country : place.state} · ${clips.toLocaleString()}`}
                      coverId={cover}
                      ratio="aspect-[4/5]"
                    />
                  </li>
                ),
            )}
          </ul>
        </section>
      )}

      {/* ======================================================== SUBJECTS */}
      {subjectRows.length > 0 && (
        <section className="shell section-minor">
          <SectionHead
            eyebrow={shared ? 'What this archive is made of' : 'What your archive is made of'}
            title={shared ? 'Subjects it keeps landing on' : 'Subjects you keep landing on'}
            href="/subjects"
            linkLabel="All subjects"
          />
          <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
            {subjectRows.map(({ subject, count, cover }, i) => (
              <li key={subject} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <CoverTile
                  href={`/subject/${encodeURIComponent(subject)}`}
                  title={subject}
                  meta={`${count.toLocaleString()} clips`}
                  coverId={cover}
                  capitalize
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="shell section-major">
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-line-soft pt-7">
          <p className="max-w-2xl text-[13px] text-faint">
            {shared ? (
              <>
                Every row above is one of their answers, matched against the archive&rsquo;s own
                place and subject metadata. Answer the same questions yourself and you will get a
                different India.
              </>
            ) : (
              <>
                Every row above is one of your answers, matched against the archive&rsquo;s own
                place and subject metadata. Nothing here is filler — if an answer found fewer than
                five clips, that is all the archive holds.
              </>
            )}
          </p>
          <Link href="/start" className="btn btn-ghost shrink-0">
            {shared ? 'Answer them yourself' : 'Change my answers'}
          </Link>
        </div>
      </section>
    </main>
  );
}

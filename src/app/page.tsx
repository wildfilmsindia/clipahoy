import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';

import { getAllClips, getCoveredPlaces, getPlace, isIndian } from '@/lib/archive';
import { getSubjectCounts, search } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { coverForPlace, coverForSubject } from '@/lib/covers';
import { recommend, summarise, type Recommendation } from '@/lib/recommend';
import { suggestionVocabulary } from '@/lib/interpret';
import { backdropClips } from '@/lib/onboarding';
import { TASTE_COOKIE, decodeTaste, hasAnswers } from '@/lib/taste';
import { VideoGrid } from '@/components/VideoGrid';
import { Rail, SectionHead } from '@/components/Rail';
import { SearchField } from '@/components/SearchField';
import { CoverTile } from '@/components/Tiles';
import { Onboarding } from '@/components/Onboarding';

const SUGGESTIONS = ['Bombay streets', 'Indian railways', 'Himalayas', 'monsoon', 'Kolkata tram'];

/** Fallback discovery rails for anyone who skipped the questions. */
const RAILS: { eyebrow: string; title: string; query: string }[] = [
  { eyebrow: 'Cities', title: 'Streets and crowds', query: 'street market crowd city' },
  { eyebrow: 'Transport', title: 'Rails, roads and rivers', query: 'railway train highway ferry' },
  { eyebrow: 'Wildlife', title: 'Creatures of the subcontinent', query: 'tiger elephant leopard bird' },
];

export default async function Home() {
  const answers = decodeTaste((await cookies()).get(TASTE_COOKIE)?.value);

  // No cookie at all means a genuinely new visitor: ask before showing.
  if (!answers) {
    return <Onboarding vocabulary={suggestionVocabulary()} backdropClips={backdropClips()} />;
  }

  // Every question skipped. Honour that with the generic feed rather than
  // pretending a personalised one was built.
  if (!hasAnswers(answers)) return <GenericFeed />;

  const rec = recommend(answers);
  if (rec.thin) return <GenericFeed thinPersonalisation />;

  return <PersonalFeed rec={rec} />;
}

/* ------------------------------------------------------------ personalised */

function PersonalFeed({ rec }: { rec: Recommendation }) {
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
            <p className="eyebrow">Your archive</p>
            <h1 className="mt-2.5 font-display text-[38px] leading-none font-light tracking-[-0.02em] sm:text-[56px]">
              Your India
            </h1>
            {summary && <p className="mt-4 max-w-2xl text-[15px] text-mute">{summary}</p>}
            <p className="mt-2 text-[13px] text-faint tabular-nums">
              {totalClips} clip{totalClips === 1 ? '' : 's'} across {rec.groups.length}{' '}
              {rec.groups.length === 1 ? 'answer' : 'answers'}
            </p>
          </div>

          <Link href="/start" className="btn btn-primary shrink-0">
            Tune your archive
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/*
        One playlist per answer, in the order the questions were asked. Capped
        at five so the page stays a set of deliberate short rows rather than an
        endless feed, and nothing appears that cannot be traced to something
        the visitor typed.
      */}
      {rec.groups.map((group, i) => {
        /*
         * Only the weaker evidence is labelled.
         *
         * A title match is the strongest signal this archive offers and is by
         * far the common case — badging every card with "in the title" would
         * put the same words on thirty cards and say nothing. Silence means the
         * answer is in the title; a badge means it qualified some other way and
         * is worth a second look.
         */
        const WEAKER_EVIDENCE: Record<string, string> = {
          place: 'filmed here',
          subject: 'tagged subject',
          text: 'from the description',
        };
        const cards = toCards(
          group.clips,
          group.reasons.map((r) => WEAKER_EVIDENCE[r] ?? ''),
        );
        return (
          <section
            key={group.questionId}
            className="shell section-major"
          >
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
            title="Places in your archive"
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
            eyebrow="What your archive is made of"
            title="Subjects you keep landing on"
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
            Every row above is one of your answers, matched against the archive&rsquo;s own place
            and subject metadata. Nothing here is filler — if an answer found fewer than five
            clips, that is all the archive holds.
          </p>
          <Link href="/start" className="btn btn-ghost shrink-0">
            Change my answers
          </Link>
        </div>
      </section>
    </main>
  );
}

/* ---------------------------------------------------------------- generic */

/** For anyone who skipped the questions, or whose answers matched too little. */
function GenericFeed({ thinPersonalisation = false }: { thinPersonalisation?: boolean }) {
  const covered = getCoveredPlaces(20);
  const subjects = getSubjectCounts();

  const seen = new Set<string>();
  const railData = RAILS.map((r) => {
    const clips = search(r.query, 60)
      .map((h) => h.clip)
      .filter((c) => !seen.has(c.id) && isIndian(c.placeId))
      .slice(0, 12);
    for (const c of clips) seen.add(c.id);
    return { ...r, cards: toCards(clips) };
  });

  const opening = toCards(
    search('street market railway temple hills', 40)
      .map((h) => h.clip)
      .filter((c) => isIndian(c.placeId))
      .slice(0, 8),
  );

  const usedCovers = new Set<string>();

  return (
    <main className="pb-16">
      <section className="shell pt-8 sm:pt-12">
        <div className="rise flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line-soft pb-7">
          <div className="min-w-0">
            <p className="eyebrow">The Wilderness Films archive</p>
            <h1 className="mt-2.5 font-display text-[34px] leading-none font-light tracking-[-0.02em] sm:text-[50px]">
              {getAllClips().length.toLocaleString()} clips of India
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] text-mute">
              {thinPersonalisation
                ? 'We could not find enough in the archive to match what you told us, so this is the whole collection. Try again with a place or a subject.'
                : 'Search it, or tell us what you already know and we will build you a version of it.'}
            </p>
          </div>

          <Link href="/start" className="btn btn-primary shrink-0">
            Make my archive
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="rise mt-8 max-w-2xl" style={{ animationDelay: '60ms' }}>
          <Suspense fallback={<div className="panel h-14 w-full rounded-sm sm:h-16" />}>
            <SearchField />
          </Suspense>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {SUGGESTIONS.map((s) => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">
                {s}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <VideoGrid cards={opening} columns="dense" eagerCount={4} />
        </div>
      </section>

      <section className="shell section-major">
        <SectionHead
          eyebrow="Explore the archive"
          title="Browse by subject"
          href="/subjects"
          linkLabel={`All ${subjects.length}`}
        />
        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {subjects.slice(0, 12).map(({ subject, count }, i) => (
            <li key={subject} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <CoverTile
                href={`/subject/${encodeURIComponent(subject)}`}
                title={subject}
                meta={`${count.toLocaleString()} clips`}
                coverId={coverForSubject(subject, usedCovers)}
                capitalize
              />
            </li>
          ))}
        </ul>
      </section>

      {railData.map((r) => (
        <Rail
          key={r.title}
          cards={r.cards}
          eyebrow={r.eyebrow}
          title={r.title}
          href={`/search?q=${encodeURIComponent(r.query)}`}
          linkLabel="See all"
        />
      ))}

      <section className="shell section-minor">
        <SectionHead
          eyebrow="Browse by place"
          title="Where the cameras went"
          href="/places"
          linkLabel={`All ${covered.length} places`}
        />
        <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {covered.slice(0, 10).map(({ place, clips }, i) => (
            <li key={place.id} className="rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <CoverTile
                href={`/place/${place.id}`}
                title={place.name}
                meta={`${place.country !== 'India' ? place.country : place.state} · ${clips.toLocaleString()}`}
                coverId={coverForPlace(place.id, usedCovers)}
                ratio="aspect-[4/5]"
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

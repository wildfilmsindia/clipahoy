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
import { VideoCard } from '@/components/VideoCard';
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

  const firstPicks = toCards(rec.firstPicks);
  const closeToHome = toCards(rec.closeToHome);
  const remember = toCards(rec.remember);
  const further = toCards(rec.further);
  const keepExploring = toCards(rec.keepExploring);

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

  return (
    <main className="pb-16">
      {/* ======================================================== MASTHEAD */}
      <section className="mx-auto w-full max-w-[1600px] px-5 pt-8 sm:px-8 sm:pt-12">
        <div className="rise flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-line-soft pb-7">
          <div className="min-w-0">
            <p className="eyebrow">Your archive</p>
            <h1 className="mt-2.5 font-display text-[38px] leading-none font-light tracking-[-0.02em] sm:text-[56px]">
              Your India
            </h1>
            {summary && <p className="mt-4 max-w-2xl text-[15px] text-mute">{summary}</p>}
          </div>

          {/*
            Personalisation is a product feature, not a setting: a real control
            at the top of the feed, not a link buried under it.
          */}
          <Link href="/start" className="btn btn-primary shrink-0">
            Tune your archive
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* ==================================================== FIRST PICKS */}
        {firstPicks.length > 0 && (
          <div className="mt-9">
            <SectionHead eyebrow="Made for you" title="Your first picks" />
            <div className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
              <div className="rise" style={{ animationDelay: '60ms' }}>
                <VideoCard data={firstPicks[0]} size="large" eager index={0} />
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {firstPicks.slice(1, 5).map((c, i) => (
                  <li
                    key={c.clip.id}
                    className="rise"
                    style={{ animationDelay: `${120 + i * 60}ms` }}
                  >
                    <VideoCard data={c} size="row" index={i + 1} />
                  </li>
                ))}
              </ul>
            </div>

            {firstPicks.length > 5 && (
              <div className="mt-9">
                <VideoGrid cards={firstPicks.slice(5)} columns="dense" eagerCount={0} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ==================================================== CLOSE TO HOME */}
      {closeToHome.length > 0 && (
        <section className="mx-auto w-full max-w-[1600px] px-5 pt-16 sm:px-8 sm:pt-20">
          <SectionHead eyebrow="Where you told us about" title="Close to home" />
          <div className="mt-7">
            <VideoGrid cards={closeToHome} columns="dense" eagerCount={0} />
          </div>
        </section>
      )}

      {/* ======================================================== REMEMBER */}
      {remember.length > 0 && (
        <Rail
          cards={remember}
          eyebrow="Older footage, same streets"
          title="You might remember this"
          href="/subject/old%20town"
          linkLabel="More like this"
        />
      )}

      {/* ========================================================== PLACES */}
      {placeRows.length > 0 && (
        <section className="mx-auto w-full max-w-[1600px] px-5 pt-10 sm:px-8 sm:pt-14">
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

      {/* ========================================================= FURTHER */}
      {further.length > 0 && (
        <Rail
          cards={further}
          eyebrow="Outside what you asked for"
          title="Go a little further"
          href="/subjects"
          linkLabel="Browse everything"
        />
      )}

      {/* ======================================================== SUBJECTS */}
      {subjectRows.length > 0 && (
        <section className="mx-auto w-full max-w-[1600px] px-5 pt-10 sm:px-8 sm:pt-14">
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

      {/* ================================================== KEEP EXPLORING */}
      {keepExploring.length > 0 && (
        <section className="mx-auto w-full max-w-[1600px] px-5 pt-16 sm:px-8 sm:pt-20">
          <SectionHead eyebrow="No particular reason" title="Keep exploring" />
          <div className="mt-7">
            <VideoGrid cards={keepExploring} columns="dense" eagerCount={0} />
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t border-line-soft pt-7">
            <p className="max-w-2xl text-[13px] text-faint">
              Ranked from the archive&rsquo;s own place and subject metadata against what you typed.
              There are no view counts, no watch history and no popularity signals here — the
              collection does not have them.
            </p>
            <Link href="/start" className="btn btn-ghost shrink-0">
              Change my interests
            </Link>
          </div>
        </section>
      )}
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
      <section className="mx-auto w-full max-w-[1600px] px-5 pt-8 sm:px-8 sm:pt-12">
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

      <section className="mx-auto w-full max-w-[1600px] px-5 pt-16 sm:px-8 sm:pt-20">
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

      <section className="mx-auto w-full max-w-[1600px] px-5 pt-10 sm:px-8 sm:pt-14">
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

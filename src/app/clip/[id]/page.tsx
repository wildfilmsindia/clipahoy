import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { getClip, getPlace } from '@/lib/archive';
import { describeClip, describeLocation } from '@/lib/describe';
import { clipsForSubject, relatedClips } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { VideoCard } from '@/components/VideoCard';
import { VideoGrid } from '@/components/VideoGrid';
import { Rail, SectionHead } from '@/components/Rail';
import { Player } from '@/components/Player';
import { recommend } from '@/lib/recommend';
import { TASTE_COOKIE, decodeTaste } from '@/lib/taste';

const LICENSE_URL = 'https://www.wildfilmsindia.com/contact';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const clip = getClip(id);
  if (!clip) return { title: 'Clip not found' };

  const place = clip.placeId ? getPlace(clip.placeId) : undefined;
  const sentence = describeClip(clip, place);

  return {
    title: sentence,
    description: clip.text?.slice(0, 160) || sentence,
    openGraph: {
      title: sentence,
      images: [`https://i.ytimg.com/vi/${clip.id}/maxresdefault.jpg`],
      type: 'video.other',
    },
  };
}

export default async function ClipPage({ params }: Props) {
  const { id } = await params;
  const clip = getClip(id);
  if (!clip) notFound();

  const place = clip.placeId ? getPlace(clip.placeId) : undefined;
  const sentence = describeClip(clip, place);
  const location = describeLocation(clip, place, sentence);

  const upNext = toCards(relatedClips(clip, 8));

  const taste = decodeTaste((await cookies()).get(TASTE_COOKIE)?.value);
  // Flattened from the per-answer playlists, so this rail is still traceable
  // to what the visitor typed rather than to a generic long tail.
  const forYou = taste
    ? toCards(
        recommend(taste)
          .groups.flatMap((g) => g.clips)
          .filter((c) => c.id !== clip.id)
          .slice(0, 10),
      )
    : [];

  const primarySubject = clip.subjects[0];
  const moreLikeThis = primarySubject
    ? toCards(
        clipsForSubject(primarySubject, 0, 20).clips.filter((c) => c.id !== clip.id).slice(0, 8),
      )
    : [];

  return (
    <main className="shell pt-8 pb-20 sm:pt-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_368px] lg:gap-10">
        {/* ------------------------------------------------------- player */}
        <div className="min-w-0">
          <Player clipId={clip.id} title={sentence} isPlaceholder={clip.isPlaceholder} />

          <h1 className="mt-6 font-display text-[26px] leading-snug font-light text-balance sm:text-[34px]">
            {sentence}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line-soft pb-6">
            {place && (
              <Link
                href={`/place/${place.id}`}
                className="group inline-flex items-center gap-2 text-[14px] text-mute transition-colors hover:text-accent"
              >
                <PinIcon />
                {location ?? place.name}
              </Link>
            )}

            {clip.year !== null && (
              /* Inferred from description text, never a filming-date field, and
                 wrong ~31% of the time where it can be checked — so it is
                 attributed rather than asserted. See AUDIT.md §F. */
              <span
                className="inline-flex items-center gap-2 text-[14px] text-mute"
                title="Year mentioned in the archive description — not a verified filming date"
              >
                <ClockIcon />
                {clip.year} <span className="text-faint">mentioned in description</span>
              </span>
            )}

            <a
              href={`https://www.youtube.com/watch?v=${clip.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[13px] text-faint transition-colors hover:text-mute"
            >
              Watch on YouTube ↗
            </a>
          </div>

          {clip.subjects.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {clip.subjects.map((s) => (
                <li key={s}>
                  <Link href={`/subject/${encodeURIComponent(s)}`} className="chip capitalize">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {clip.text && (
            <div className="panel mt-6 p-5">
              <p className="eyebrow">From the archive record</p>
              <p className="mt-3 text-[15px] leading-relaxed text-mute">{clip.text}</p>
            </div>
          )}

          <div className="panel mt-4 flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-display text-[18px] text-paper">License this footage</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">
                Broadcast-quality masters are available from Wilderness Films India.
              </p>
            </div>
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary shrink-0"
            >
              Enquire
            </a>
          </div>
        </div>

        {/* ------------------------------------------------------ up next */}
        <aside className="min-w-0">
          <p className="eyebrow rule-accent">
            {place ? `More from ${place.name}` : 'Related footage'}
          </p>
          <ul className="mt-5 space-y-4">
            {upNext.map((c, i) => (
              <li key={c.clip.id} className="rise" style={{ animationDelay: `${i * 40}ms` }}>
                <VideoCard data={c} size="row" index={i} />
              </li>
            ))}
          </ul>
          {place && (
            <Link
              href={`/place/${place.id}`}
              className="btn btn-ghost mt-5 w-full"
            >
              All {place.name} footage
            </Link>
          )}
        </aside>
      </div>

      {moreLikeThis.length > 0 && (
        <section className="mt-20">
          <SectionHead
            eyebrow="Keep exploring"
            title={`More ${primarySubject}`}
            href={`/subject/${encodeURIComponent(primarySubject!)}`}
            linkLabel="See all"
          />
          <div className="mt-7">
            <VideoGrid cards={moreLikeThis} columns="dense" eagerCount={0} />
          </div>
        </section>
      )}

      {/*
        Carries the personalised feed into the watch page, so a viewer who
        follows a link out of their feed can get back into it without
        returning home. Absent entirely for anyone who never answered.
      */}
      {forYou.length > 0 && (
        <Rail
          flush
          cards={forYou}
          eyebrow="Made for you"
          title="You might also like"
          href="/"
          linkLabel="Your archive"
        />
      )}
    </main>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M8 14s5-4.35 5-8A5 5 0 0 0 3 6c0 3.65 5 8 5 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="8" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

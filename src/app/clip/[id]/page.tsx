import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClip, getPlace } from '@/lib/archive';
import { describeClip, describeLocation } from '@/lib/describe';
import { relatedClips } from '@/lib/search';
import { toCards } from '@/lib/cards';
import { ClipGrid } from '@/components/ClipGrid';
import { Player } from '@/components/Player';

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
  const related = toCards(relatedClips(clip, 6));

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pt-8 pb-16 sm:px-8 sm:pt-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0">
          <Player clipId={clip.id} title={sentence} isPlaceholder={clip.isPlaceholder} />

          <h1 className="mt-7 font-display text-[24px] leading-snug font-light text-balance sm:text-[30px]">
            {sentence}
          </h1>

          {location && (
            <p className="mt-3 text-[14px] text-mute">
              {place ? (
                <Link
                  href={`/place/${place.id}`}
                  className="underline decoration-line underline-offset-4 transition-colors hover:text-paper hover:decoration-accent"
                >
                  {location}
                </Link>
              ) : (
                location
              )}
            </p>
          )}

          {clip.subjects.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
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
            <div className="mt-8 max-w-2xl border-t border-line-soft pt-7">
              <p className="eyebrow">From the archive record</p>
              <p className="mt-3 text-[15px] leading-relaxed text-mute">{clip.text}</p>
            </div>
          )}
        </div>

        {/* -------------------------------------------------------- sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-5">
            <p className="eyebrow">Licensing</p>
            <p className="mt-3 text-[14px] leading-relaxed text-mute">
              This footage is available to license from Wilderness Films India.
            </p>
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary mt-5 w-full"
            >
              License this footage
            </a>
            <a
              href={`https://www.youtube.com/watch?v=${clip.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost mt-2.5 w-full"
            >
              Watch on YouTube
            </a>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line-soft pb-5">
            <div>
              <p className="eyebrow">Nearby in the archive</p>
              <h2 className="mt-2.5 font-display text-[24px] leading-tight font-light sm:text-[28px]">
                {place ? `More from ${place.name}` : 'Related footage'}
              </h2>
            </div>
            {place && (
              <Link
                href={`/place/${place.id}`}
                className="group inline-flex items-center gap-1.5 text-[14px] text-mute transition-colors hover:text-paper"
              >
                All of {place.name}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            )}
          </div>
          <div className="mt-8">
            <ClipGrid cards={related} priorityCount={3} />
          </div>
        </section>
      )}
    </main>
  );
}

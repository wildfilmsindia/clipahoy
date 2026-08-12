'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Clip } from '@/lib/types';
import { Thumbnail } from './Thumbnail';

export type ClipCard = {
  clip: Clip;
  /** The one composed sentence describing the footage. */
  sentence: string;
  /** Where it is, as prose. Null when the sentence already says so. */
  location: string | null;
};

/**
 * Renders clip results.
 *
 * Rules this component exists to enforce, all carried over from the previous
 * implementation because they were load-bearing:
 *
 *  - A result is ONE sentence, never a pile of tags. Composed upstream in
 *    src/lib/describe.ts; nothing here adds place or subject chips beside it.
 *  - No dates. AUDIT.md §F: there is no filming-date field in the corpus and
 *    71.3% of clips carry no date signal, so `Clip.year` is never rendered.
 *  - At most one <iframe> in the tree. This component owns `playingId`;
 *    everything else stays a static thumbnail facade, which is what keeps a
 *    60-result page usable on a phone.
 */
export function ClipGrid({
  cards,
  priorityCount = 6,
}: {
  cards: ClipCard[];
  /** How many thumbnails load eagerly. The rest are lazy. */
  priorityCount?: number;
}) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (cards.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <li
          key={card.clip.id}
          className="rise"
          // Stagger caps quickly: a long list should not ripple for seconds.
          style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
        >
          <ClipTile
            card={card}
            eager={i < priorityCount}
            isPlaying={playingId === card.clip.id}
            onPlay={() => setPlayingId(card.clip.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function ClipTile({
  card,
  isPlaying,
  eager,
  onPlay,
}: {
  card: ClipCard;
  isPlaying: boolean;
  eager: boolean;
  onPlay: () => void;
}) {
  const { clip, sentence, location } = card;

  return (
    <figure className="group">
      <div className="relative aspect-video overflow-hidden rounded-sm border border-line bg-surface transition-colors duration-200 group-hover:border-faint">
        {clip.isPlaceholder ? (
          <PlaceholderFrame id={clip.id} />
        ) : isPlaying ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${clip.id}?autoplay=1&rel=0&modestbranding=1`}
            title={sentence}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <Facade clip={clip} label={sentence} eager={eager} onPlay={onPlay} />
        )}
      </div>

      <figcaption className="mt-3.5">
        <Link
          href={`/clip/${clip.id}`}
          className="font-display text-[17px] leading-snug font-light text-paper decoration-faint underline-offset-4 transition-colors hover:decoration-accent hover:underline"
        >
          {sentence}
        </Link>

        {location && <p className="mt-2 text-[12.5px] text-faint">{location}</p>}
      </figcaption>
    </figure>
  );
}

function PlaceholderFrame({ id }: { id: string }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between p-3">
      <span className="eyebrow">Placeholder</span>
      <span className="font-display text-[13px] tabular-nums text-faint">{id}</span>
    </div>
  );
}

function Facade({
  clip,
  label,
  eager,
  onPlay,
}: {
  clip: Clip;
  label: string;
  eager: boolean;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play: ${label}`}
      className="absolute inset-0 h-full w-full cursor-pointer"
    >
      <Thumbnail
        videoId={clip.id}
        eager={eager}
        className="absolute inset-0 h-full w-full scale-[1.01] object-cover opacity-90 transition-[transform,opacity] duration-500 ease-out group-hover:scale-[1.045] group-hover:opacity-100"
      />

      {/* Bottom scrim: keeps the play affordance legible on pale thumbnails. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent"
      />

      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-ink/55 backdrop-blur-[2px] transition-[transform,background-color] duration-300 group-hover:scale-110 group-hover:bg-accent">
          <svg
            viewBox="0 0 24 24"
            className="ml-0.5 h-4 w-4 fill-paper transition-colors duration-300 group-hover:fill-ink"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

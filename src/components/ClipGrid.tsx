'use client';

import { useState } from 'react';
import type { Clip } from '@/lib/types';

const LICENSE_URL = 'https://www.wildfilmsindia.com/contact';

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
 * Two rules this component exists to enforce:
 *
 *  - A result is ONE sentence, never a pile of tags. The sentence is composed
 *    upstream (src/lib/describe.ts); this component must not add place or
 *    subject chips alongside it.
 *  - No dates. AUDIT.md §F established there is no filming-date field in the
 *    corpus and 71.3% of clips have no date signal at all, so `Clip.year`
 *    exists in the data model but is never rendered.
 *
 * The single-iframe rule also lives here: this component owns `playingId`, so
 * at most one YouTube player can exist in the tree. Everything else is a
 * static thumbnail facade, which is what keeps a long result list usable on a
 * phone.
 */
export function ClipGrid({ cards }: { cards: ClipCard[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (cards.length === 0) return null;

  return (
    <ul className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <li key={card.clip.id}>
          <ClipTile
            card={card}
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
  onPlay,
}: {
  card: ClipCard;
  isPlaying: boolean;
  onPlay: () => void;
}) {
  const { clip, sentence, location } = card;

  return (
    <figure className="group">
      <div className="relative aspect-video overflow-hidden rounded border border-hairline bg-raised">
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
          <Facade clip={clip} label={sentence} onPlay={onPlay} />
        )}
      </div>

      <figcaption className="mt-3">
        <p className="font-display text-[16px] leading-snug font-light text-paper/90">{sentence}</p>
        {location && <p className="mt-1.5 text-[12px] text-muted">{location}</p>}
      </figcaption>

      <a
        href={LICENSE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-[11px] tracking-wide text-muted underline-offset-4 transition-colors hover:text-slate hover:underline"
      >
        License this footage
      </a>
    </figure>
  );
}

function PlaceholderFrame({ id }: { id: string }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between p-3">
      <span className="text-[10px] tracking-[0.14em] text-muted uppercase">Placeholder</span>
      <span className="font-display text-[13px] tabular-nums text-muted">{id}</span>
    </div>
  );
}

function Facade({ clip, label, onPlay }: { clip: Clip; label: string; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play: ${label}`}
      className="absolute inset-0 h-full w-full cursor-pointer"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${clip.id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-85 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-ground/70 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
          <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4 fill-paper" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}

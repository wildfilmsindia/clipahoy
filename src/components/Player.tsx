'use client';

import { useState } from 'react';

import { Thumbnail } from './Thumbnail';

/**
 * Detail-page player.
 *
 * Still a facade first: the iframe mounts only on click, so arriving at a clip
 * page costs one image rather than a full YouTube player. Matches the rule
 * ClipGrid enforces for result lists.
 */
export function Player({
  clipId,
  title,
  isPlaceholder,
}: {
  clipId: string;
  title: string;
  isPlaceholder: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  if (isPlaceholder) {
    return (
      <div className="flex aspect-video flex-col justify-between rounded-sm border border-line bg-surface p-4">
        <span className="eyebrow">Placeholder</span>
        <span className="font-display text-[14px] tabular-nums text-faint">{clipId}</span>
      </div>
    );
  }

  return (
    <div className="group relative aspect-video overflow-hidden rounded-sm border border-line bg-surface">
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${clipId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play: ${title}`}
          className="absolute inset-0 h-full w-full cursor-pointer"
        >
          <Thumbnail
            videoId={clipId}
            eager
            priority
            className="absolute inset-0 h-full w-full object-cover opacity-95 transition-opacity duration-300 group-hover:opacity-100"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent"
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-ink/60 backdrop-blur-[2px] transition-[transform,background-color] duration-300 group-hover:scale-105 group-hover:bg-accent">
              <svg
                viewBox="0 0 24 24"
                className="ml-1 h-6 w-6 fill-paper transition-colors duration-300 group-hover:fill-ink"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

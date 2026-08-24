'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Thumbnail } from './Thumbnail';
import type { Clip } from '@/lib/types';

export type CardData = {
  clip: Clip;
  /** The one composed sentence describing the footage (src/lib/describe.ts). */
  sentence: string;
  /** Where it is, as prose. Null when the sentence already says so. */
  location: string | null;
  /** Description prose with the shared rights-holder tail stripped. */
  blurb: string | null;
  /**
   * Why this clip is on the page.
   *
   * Only the personalised feed sets it: a row already says which question and
   * answer it came from, but not why any individual clip qualified, so a wrong
   * pick looked identical to a right one. Browse and search results leave it
   * unset — there, the query is the explanation.
   */
  reason?: string;
};

export type CardSize = 'hero' | 'large' | 'standard' | 'compact' | 'row';

/**
 * The product's core object.
 *
 * Variants exist so a page can build visual rhythm instead of repeating one
 * 3-column grid: `hero` for a full-bleed lead, `large` for a featured slot,
 * `standard` for grids, `compact` for rails, `row` for the horizontal
 * list used beside a player.
 *
 * Playback is never mounted here — the card links to /clip/[id]. That keeps
 * the one-iframe rule absolute for browsing surfaces.
 */
export function VideoCard({
  data,
  size = 'standard',
  eager = false,
  index = 0,
}: {
  data: CardData;
  size?: CardSize;
  eager?: boolean;
  index?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const { clip, sentence, location } = data;

  if (size === 'row') return <RowCard data={data} hovered={hovered} setHovered={setHovered} />;

  const isBig = size === 'hero' || size === 'large';

  return (
    <article
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <Link href={`/clip/${clip.id}`} className="block outline-none">
        <div
          className={`relative overflow-hidden bg-surface transition-[transform,box-shadow,border-color] duration-400 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:-translate-y-1 group-focus-within:-translate-y-1 ${
            isBig ? 'rounded-md' : 'rounded-sm'
          } border border-line group-hover:border-forest-bright/60 group-hover:shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]`}
        >
          <div className="relative aspect-video">
            {clip.isPlaceholder ? (
              <PlaceholderFrame id={clip.id} />
            ) : (
              <Thumbnail
                videoId={clip.id}
                eager={eager}
                priority={size === 'hero'}
                preview={isBig}
                hovered={hovered}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.06]"
              />
            )}

            {/*
              Big cards carry their title and metadata ON the image, so they
              need a deeper foot than small cards, whose text sits underneath.
              At from-black/80 the metadata line was washing out against busy
              architecture shots.
            */}
            <span
              aria-hidden="true"
              className={`absolute inset-0 transition-opacity duration-300 group-hover:opacity-100 ${
                isBig
                  ? 'bg-gradient-to-t from-black/95 via-black/45 to-transparent opacity-90'
                  : 'bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-70'
              }`}
            />

            <PlayBadge big={isBig} />

            {/*
              No year badge. `year` is scraped from description text, not a
              filming-date field, and it grabs any 4-digit year in the prose —
              a subject's birth year, a film's release. Measured against clips
              whose own text names a decade, 30.9% of the values contradict it.
              An unqualified "c. 1956" over a visibly-1990s frame is a factual
              claim the data cannot support, so the year is shown only on the
              clip page, labelled as coming from the description.
            */}

            {/* Metadata rides on the thumbnail for the big variants. */}
            {isBig && (
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <h3
                  className={`font-display font-light text-paper clamp-2 ${
                    size === 'hero' ? 'text-[22px] sm:text-[30px]' : 'text-[18px] sm:text-[21px]'
                  } leading-snug`}
                >
                  {sentence}
                </h3>
                <MetaLine clip={clip} location={location} reason={data.reason} className="mt-2.5" />
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Small variants carry their metadata beneath, YouTube-style. */}
      {!isBig && (
        <div className="mt-3">
          <Link href={`/clip/${clip.id}`} className="block">
            <h3 className="font-display text-[16px] leading-snug font-light text-paper transition-colors duration-200 clamp-2 group-hover:text-accent">
              {sentence}
            </h3>
          </Link>
          <MetaLine clip={clip} location={location} reason={data.reason} className="mt-2" />
          {size === 'standard' && data.blurb && (
            <p className="mt-2 text-[13px] leading-relaxed text-faint opacity-0 transition-opacity duration-300 clamp-2 group-hover:opacity-100">
              {data.blurb}
            </p>
          )}
        </div>
      )}

      <span className="sr-only">{`Result ${index + 1}`}</span>
    </article>
  );
}

/* ------------------------------------------------------------------ row */

function RowCard({
  data,
  hovered,
  setHovered,
}: {
  data: CardData;
  hovered: boolean;
  setHovered: (v: boolean) => void;
}) {
  const { clip, sentence, location } = data;

  return (
    <article
      className="group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link href={`/clip/${clip.id}`} className="flex gap-3.5">
        <div className="relative aspect-video w-[42%] shrink-0 overflow-hidden rounded-sm border border-line bg-surface transition-colors group-hover:border-forest-bright/60 sm:w-[168px]">
          {clip.isPlaceholder ? (
            <PlaceholderFrame id={clip.id} />
          ) : (
            <Thumbnail
              videoId={clip.id}
              hovered={hovered}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.07]"
            />
          )}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[14.5px] leading-snug font-light text-paper transition-colors clamp-3 group-hover:text-accent">
            {sentence}
          </h3>
          {location && <p className="mt-1.5 text-[12px] text-faint">{location}</p>}
        </div>
      </Link>
    </article>
  );
}

/* --------------------------------------------------------------- pieces */

function MetaLine({
  clip,
  location,
  reason,
  className = '',
}: {
  clip: Clip;
  location: string | null;
  reason?: string;
  className?: string;
}) {
  const bits: string[] = [];
  if (location) bits.push(location);
  if (clip.subjects.length) bits.push(clip.subjects.slice(0, 2).join(' · '));

  if (bits.length === 0 && !reason) return null;

  return (
    <p className={`flex flex-wrap items-center gap-x-2 text-[12.5px] text-mute ${className}`}>
      {bits.map((b, i) => (
        <span key={b} className={i > 0 ? 'text-faint capitalize' : ''}>
          {i > 0 && <span className="mr-2 text-faint">·</span>}
          {b}
        </span>
      ))}
      {/*
        Why this clip is here. Quiet on purpose — it should be checkable when
        a result looks wrong, not competing with the footage when it is right.
      */}
      {reason && (
        <span className="rounded-full border border-line px-1.5 py-px text-[10.5px] tracking-wide text-faint">
          {reason}
        </span>
      )}
    </p>
  );
}

/*
 * The badge is centred on the frame, but a big card's title occupies the lower
 * third. On a 390px hero the two collided — the play circle sat on top of the
 * headline. Big variants therefore centre the badge on the *upper* portion,
 * clear of the metadata block.
 */
function PlayBadge({ big }: { big: boolean }) {
  return (
    <span
      className={`absolute inset-x-0 top-0 grid place-items-center ${
        big ? 'bottom-[38%]' : 'bottom-0'
      }`}
    >
      <span
        className={`grid place-items-center rounded-full border border-white/20 bg-black/45 backdrop-blur-[3px] transition-[transform,background-color,border-color,opacity] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)] group-hover:scale-110 group-hover:border-accent group-hover:bg-accent ${
          big ? 'h-12 w-12 opacity-90 sm:h-16 sm:w-16' : 'h-12 w-12 opacity-0 group-hover:opacity-100'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`ml-0.5 fill-paper transition-colors duration-300 group-hover:fill-[#14100a] ${
            big ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-4 w-4'
          }`}
          aria-hidden="true"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

function PlaceholderFrame({ id }: { id: string }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-between bg-surface-2 p-3">
      <span className="eyebrow">Placeholder</span>
      <span className="font-display text-[13px] tabular-nums text-faint">{id}</span>
    </div>
  );
}

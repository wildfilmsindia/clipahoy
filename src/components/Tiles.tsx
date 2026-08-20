import Link from 'next/link';

import { Thumbnail } from './Thumbnail';

/**
 * Cover tiles for subject and place discovery.
 *
 * Both surfaces used to hand-roll the same markup with slightly different
 * scrims, which is how one page ended up dimming its images to 45% and reading
 * as a grid of black rectangles. One component, one treatment.
 */

const TILE = 'group relative block overflow-hidden rounded-sm border border-line transition-[border-color,transform] duration-300 hover:-translate-y-1 hover:border-accent/60';

/*
 * Bottom-weighted, and deliberately steep.
 *
 * A full-height scrim over a dimmed image kills the art, but the previous
 * gradient only reached 55% opacity where the label sits — and every thumbnail
 * in this archive carries a "www.wildfilmsindia.com" watermark across roughly
 * that band, so the subject name was read on top of a URL. Solid under the
 * text, clear by two-thirds up: the label wins without flattening the frame.
 */
const SCRIM =
  'absolute inset-0 bg-gradient-to-t from-ink from-18% via-ink/70 via-42% to-transparent to-72% transition-colors duration-500 group-hover:from-forest group-hover:via-forest/60';

export function CoverTile({
  href,
  title,
  meta,
  coverId,
  ratio = 'aspect-[5/4]',
  eager = false,
  capitalize = false,
}: {
  href: string;
  title: string;
  meta?: string;
  coverId?: string;
  ratio?: string;
  eager?: boolean;
  capitalize?: boolean;
}) {
  return (
    <Link href={href} className={`${TILE} ${ratio}`}>
      {coverId && (
        <Thumbnail
          videoId={coverId}
          eager={eager}
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition-[transform,opacity] duration-700 group-hover:scale-110 group-hover:opacity-100"
        />
      )}
      <span aria-hidden="true" className={SCRIM} />
      <span className="absolute inset-0 flex flex-col justify-end p-3.5">
        <span
          className={`font-display text-[17px] leading-tight text-paper transition-colors group-hover:text-accent ${
            capitalize ? 'capitalize' : ''
          }`}
        >
          {title}
        </span>
        {meta && <span className="mt-1 text-[11.5px] text-mute">{meta}</span>}
      </span>
    </Link>
  );
}

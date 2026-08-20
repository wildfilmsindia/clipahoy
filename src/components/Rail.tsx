import Link from 'next/link';

import { VideoCard, type CardData } from './VideoCard';

/**
 * Horizontal scrolling row.
 *
 * Gives the homepage rhythm that a uniform grid cannot, and on mobile it turns
 * a long section into a swipe instead of an endless column. Snap points keep
 * cards aligned; the scrollbar is hidden but the rail stays keyboard and
 * trackpad scrollable.
 */
export function Rail({
  cards,
  eyebrow,
  title,
  href,
  linkLabel,
  flush = false,
}: {
  cards: CardData[];
  eyebrow: string;
  title: string;
  href: string;
  linkLabel: string;
  /**
   * Set when the rail sits inside a container that already provides the page
   * gutter. Without it the rail adds its own padding on top and the cards
   * drift out of alignment with the heading above them.
   */
  flush?: boolean;
}) {
  if (cards.length === 0) return null;

  const gutter = flush ? '' : 'shell';

  /*
   * Too few cards to scroll? Lay them out as a grid instead.
   *
   * The rail reserves a fixed width per card, so a two-card row left most of
   * the track empty and read as truncated rather than as a short list — the
   * personalised feed hits this whenever a section has thin matches.
   */
  const sparse = cards.length < 4;

  /*
   * Columns match the card count, so two cards fill the row instead of
   * occupying two slots of four and leaving it looking half-loaded.
   */
  const sparseCols =
    cards.length === 1
      ? 'grid-cols-1 sm:grid-cols-2'
      : cards.length === 2
        ? 'grid-cols-2'
        : 'grid-cols-2 sm:grid-cols-3';

  return (
    <section className="py-10 sm:py-14">
      <div className={gutter}>
        <SectionHead eyebrow={eyebrow} title={title} href={href} linkLabel={linkLabel} />
      </div>

      <div className="mt-7 overflow-hidden">
        <ul
          className={
            sparse
              ? `grid gap-x-5 gap-y-9 ${sparseCols} ${
                  flush ? '' : 'shell'
                }`
              : `rail ${flush ? '' : 'shell'}`
          }
        >
          {cards.map((data, i) => (
            <li
              key={data.clip.id}
              className={
                sparse
                  ? 'rise'
                  : 'rise w-[74vw] sm:w-[46vw] lg:w-[30vw] xl:w-[22vw] 2xl:w-[19vw]'
              }
              style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
            >
              <VideoCard data={data} size="compact" eager={i < 4} index={i} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  href,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="rule-accent">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-[26px] leading-tight font-light sm:text-[34px]">
          {title}
        </h2>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-[14px] text-mute transition-colors hover:text-accent"
        >
          {linkLabel}
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </Link>
      )}
    </div>
  );
}

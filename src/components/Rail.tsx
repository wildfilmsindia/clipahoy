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

  const gutter = flush ? '' : 'mx-auto w-full max-w-[1600px] px-5 sm:px-8';

  return (
    <section className="py-10 sm:py-14">
      <div className={gutter}>
        <SectionHead eyebrow={eyebrow} title={title} href={href} linkLabel={linkLabel} />
      </div>

      <div className="mt-7 overflow-hidden">
        <ul className={`rail ${flush ? '' : 'mx-auto max-w-[1600px] px-5 sm:px-8'}`}>
          {cards.map((data, i) => (
            <li
              key={data.clip.id}
              className="rise w-[74vw] sm:w-[46vw] lg:w-[30vw] xl:w-[22vw] 2xl:w-[19vw]"
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

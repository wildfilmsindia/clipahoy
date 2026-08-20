import { VideoCard, type CardData, type CardSize } from './VideoCard';

/** Standard responsive grid. Staggered entrance, capped so long lists don't ripple. */
export function VideoGrid({
  cards,
  size = 'standard',
  eagerCount = 6,
  columns = 'default',
}: {
  cards: CardData[];
  size?: CardSize;
  eagerCount?: number;
  columns?: 'default' | 'wide' | 'dense' | 'playlist';
}) {
  if (cards.length === 0) return null;

  /*
   * `playlist` is sized for exactly five: a capped answer row should land as
   * one clean line on a wide screen rather than four-plus-an-orphan. It steps
   * 2 → 3 → 5 so the last row is never a single stranded card.
   */
  const cols =
    columns === 'playlist'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
      : columns === 'wide'
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : columns === 'dense'
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

  return (
    <ul className={`grid gap-x-5 gap-y-9 ${cols}`}>
      {cards.map((data, i) => (
        <li key={data.clip.id} className="rise" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
          <VideoCard data={data} size={size} eager={i < eagerCount} index={i} />
        </li>
      ))}
    </ul>
  );
}

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
   * `playlist` is not a column count — it is a swipeable rail on a phone that
   * becomes a row of five on a desktop. See `.playlist-row` in globals.css.
   */
  if (columns === 'playlist') {
    return (
      <ul className="playlist-row">
        {cards.map((data, i) => (
          <li key={data.clip.id} className="rise" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
            <VideoCard data={data} size={size} eager={i < eagerCount} index={i} />
          </li>
        ))}
      </ul>
    );
  }

  const cols =
    columns === 'wide'
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
        : columns === 'dense'
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
          /*
       * Denser on wide screens. Three cards across a 1280px browser left a
       * video archive looking sparse and pushed most results below the fold;
       * four keeps cards comfortably above 280px while showing a third more
       * per screen.
       */
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

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

'use client';

/**
 * YouTube thumbnail with a correct maxres → hq fallback.
 *
 * The subtlety this exists for: when `maxresdefault.jpg` does not exist — true
 * for most pre-2010 uploads in this archive — YouTube does NOT return 404. It
 * returns **HTTP 200 with a 120x90 grey placeholder**. So an `onError` handler
 * never fires and the card renders a grey box.
 *
 * Detecting it by natural size on load is the only reliable signal. 120x90 is
 * the sentinel; a real maxres frame is 1280x720.
 */
const PLACEHOLDER_MAX_WIDTH = 121;

export function Thumbnail({
  videoId,
  eager = false,
  priority = false,
  className = '',
}: {
  videoId: string;
  eager?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const swapToHq = (img: HTMLImageElement) => {
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  };

  return (
    /*
      next/image is deliberately not used: these are third-party URLs across
      73k clips, so optimising them would proxy every thumbnail through the
      server for no gain.
    */
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
      onLoad={(e) => {
        // The 200-with-grey-placeholder case.
        if (e.currentTarget.naturalWidth <= PLACEHOLDER_MAX_WIDTH) swapToHq(e.currentTarget);
      }}
      onError={(e) => swapToHq(e.currentTarget)}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  );
}

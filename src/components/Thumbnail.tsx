'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * YouTube thumbnail with a correct fallback and an optional hover preview.
 *
 * THE FALLBACK SUBTLETY: when `maxresdefault.jpg` does not exist — true for
 * most pre-2010 uploads here — YouTube does NOT 404. It returns **HTTP 200
 * with a 120x90 grey placeholder**, so an `onError` handler never fires and
 * the card renders a grey box. Natural size on load is the only reliable
 * signal; 120x90 is the sentinel, a real frame is 1280x720.
 *
 * THE HYDRATION TRAP: the markup is server-rendered, so a cached thumbnail is
 * often already decoded before React attaches handlers — `onLoad` then never
 * fires and the grey box survives. The ref callback re-checks `complete` at
 * mount to catch exactly those. Both paths are needed: ref for already-loaded,
 * onLoad for still-loading.
 *
 * THE PREVIEW: YouTube exposes three storyboard frames per video at
 * `hq1/hq2/hq3.jpg` (480x360 each). Cycling those on hover gives a real sense
 * of the footage without mounting a second iframe, which would break the
 * one-player rule and wreck a long result page on mobile.
 */
const PLACEHOLDER_MAX_WIDTH = 121;
const FRAME_MS = 900;

export function Thumbnail({
  videoId,
  eager = false,
  priority = false,
  preview = false,
  hovered = false,
  className = '',
}: {
  videoId: string;
  eager?: boolean;
  priority?: boolean;
  /** Enable the storyboard-frame hover preview. */
  preview?: boolean;
  /** Driven by the parent card so one hover state controls image + chrome. */
  hovered?: boolean;
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /*
   * Reset during render rather than in an effect. Clearing the frame inside
   * the effect meant one render with the stale frame and another with 0 — the
   * cascading-render pattern React warns about.
   */
  const [wasHovered, setWasHovered] = useState(hovered);
  if (hovered !== wasHovered) {
    setWasHovered(hovered);
    if (!hovered) setFrame(0);
  }

  useEffect(() => {
    if (!preview || !hovered) return;

    // Short delay so a cursor crossing a grid does not start every card.
    const start = setTimeout(() => {
      timer.current = setInterval(() => setFrame((f) => (f + 1) % 4), FRAME_MS);
    }, 420);

    return () => {
      clearTimeout(start);
      if (timer.current) clearInterval(timer.current);
    };
  }, [hovered, preview]);

  const swapToHq = useCallback(
    (img: HTMLImageElement) => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = '1';
      img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    },
    [videoId],
  );

  const inspect = useCallback(
    (img: HTMLImageElement | null) => {
      // naturalWidth 0 on a complete image means it failed; both cases fall back.
      if (!img || !img.complete) return;
      if (img.naturalWidth === 0 || img.naturalWidth <= PLACEHOLDER_MAX_WIDTH) swapToHq(img);
    },
    [swapToHq],
  );

  return (
    <>
      {/*
        next/image is deliberately unused: these are third-party URLs across
        73k clips, so optimising them would proxy every thumbnail for no gain.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={inspect}
        src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= PLACEHOLDER_MAX_WIDTH) swapToHq(e.currentTarget);
        }}
        onError={(e) => swapToHq(e.currentTarget)}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={className}
      />

      {preview && frame > 0 && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hq${frame}.jpg`}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={`${className} fade-in`}
        />
      )}
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Share this curated India.
 *
 * Two behaviours, because the right one differs by device: on a phone the
 * native share sheet is what people expect and it reaches WhatsApp, which is
 * how a link like this will actually travel. On a desktop there is usually no
 * share sheet, so it copies instead and says so.
 *
 * The URL is built on the server and passed in, rather than read from
 * `window.location`: this button also appears on a page whose address is `/`,
 * where the current location carries no answers at all.
 */
export function ShareButton({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === 'idle') return;
    timer.current = setTimeout(() => setState('idle'), 2500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state]);

  async function share() {
    /*
     * Resolved to absolute here rather than on the server, which does not know
     * the deployed origin — it differs between local, preview and production.
     * A relative path would be useless the moment it was pasted anywhere.
     */
    const absolute = new URL(url, window.location.origin).toString();

    // Feature-detected at click time, not at render: doing it during render
    // makes the button's markup differ between server and client.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'My India, on Clipahoy',
          text: 'I curated a tour of India from 37 years of archive footage. Here is mine.',
          url: absolute,
        });
        return;
      } catch {
        // Dismissing the sheet throws too, so fall through to copying rather
        // than reporting a failure the person caused deliberately.
      }
    }

    try {
      await navigator.clipboard.writeText(absolute);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return (
    <button type="button" onClick={share} className="btn btn-ghost">
      {state === 'copied' ? (
        <>
          <CheckIcon />
          Link copied
        </>
      ) : state === 'failed' ? (
        'Press ⌘C to copy'
      ) : (
        <>
          <ShareIcon />
          Share
        </>
      )}
      {/* The outcome reaches a screen reader, which cannot see the label change. */}
      <span aria-live="polite" className="sr-only">
        {state === 'copied' ? 'Link copied to clipboard' : ''}
      </span>
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 10V2M8 2 5 5M8 2l3 3" />
      <path d="M3 9v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

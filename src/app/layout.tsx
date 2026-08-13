import type { Metadata, Viewport } from 'next';
import { Newsreader, IBM_Plex_Sans } from 'next/font/google';
import { Suspense } from 'react';
import { cookies } from 'next/headers';

import { getAllClips, getCoveredPlaces } from '@/lib/archive';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Backdrop } from '@/components/Backdrop';
import { TASTE_COOKIE, decodeTaste, hasAnswers } from '@/lib/taste';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['200', '300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Clipahoy — explore India on film',
    template: '%s — Clipahoy',
  },
  description:
    'Search decades of factual footage of ordinary India from the Wilderness Films archive.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const clips = getAllClips().length;
  const places = getCoveredPlaces(20).length;

  // Read here rather than in Header: the header is a client component, and a
  // server read means the correct label ships in the first HTML.
  const personalised = hasAnswers(decodeTaste((await cookies()).get(TASTE_COOKIE)?.value));

  return (
    <html lang="en" className={`${newsreader.variable} ${plex.variable}`}>
      {/*
        No bg-* utility on body: html paints the ink base. An opaque background
        here covers every negative-z-index layer, which hid the Backdrop
        completely and made the site render flat black however strong its
        gradients were.
      */}
      <body className="relative min-h-dvh text-paper antialiased">
        <Backdrop />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>

        {/* Header reads searchParams, which requires a Suspense boundary. */}
        <Suspense fallback={<div className="h-16 border-b border-transparent" />}>
          <Header personalised={personalised} />
        </Suspense>

        <div id="main">{children}</div>

        <Footer clips={clips} places={places} />
      </body>
    </html>
  );
}

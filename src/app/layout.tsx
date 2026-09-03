import type { Metadata, Viewport } from 'next';
import { Newsreader, IBM_Plex_Sans } from 'next/font/google';
import { Suspense } from 'react';
import { Analytics } from '@vercel/analytics/next';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Backdrop } from '@/components/Backdrop';
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

/*
 * Reads the taste cookie before first paint and marks <html>.
 *
 * The nav label depends on whether someone has personalised, but reading the
 * cookie in this layout made EVERY route server-rendered on demand, including
 * /subjects and /places which have nothing user-specific on them. Doing it in
 * a blocking inline script keeps those pages static and still avoids the
 * label flashing from "Make my archive" to "My Archive" after hydration —
 * both labels are in the HTML and CSS picks one, so there is no mismatch.
 */
const TASTE_FLAG = `try{var m=document.cookie.match(/clipahoy_taste=([^;]+)/);if(m){var a=JSON.parse(decodeURIComponent(m[1])).a;if(a&&Object.keys(a).some(function(k){return String(a[k]).trim()}))document.documentElement.dataset.taste='1'}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plex.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TASTE_FLAG }} />
      </head>
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
          <Header />
        </Suspense>

        <div id="main">{children}</div>

        <Footer />
        <Analytics />
      </body>
    </html>
  );
}

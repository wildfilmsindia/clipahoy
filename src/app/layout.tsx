import type { Metadata, Viewport } from 'next';
import { Newsreader, IBM_Plex_Sans } from 'next/font/google';
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
  title: 'Clipahoy — explore India on film',
  description:
    'Decades of footage of ordinary India from the Wilderness Films archive. Search it, or start from a place.',
};

export const viewport: Viewport = {
  themeColor: '#0b0e12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plex.variable}`}>
      <body className="min-h-dvh bg-ground text-paper antialiased">{children}</body>
    </html>
  );
}

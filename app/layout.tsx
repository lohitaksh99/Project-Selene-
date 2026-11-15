import type {Metadata} from 'next';
import {Inter, IBM_Plex_Mono} from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'NASA Lunar Landing Navigator — Cinematic Editorial Exploration & Mission System',
  description:
    'A cinematic editorial space-exploration platform and decision-support instrument for evaluating NASA Artemis Lunar South Pole landing sites, terrain hazards, sunlight regimes, and Earth direct-to-Earth communication links.',
  openGraph: {
    title: 'NASA Lunar Landing Navigator — Cinematic Editorial Exploration & Mission System',
    description:
      'A cinematic editorial space-exploration platform and decision-support instrument for evaluating NASA Artemis Lunar South Pole landing sites, terrain hazards, sunlight regimes, and Earth direct-to-Earth communication links.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NASA Lunar Landing Navigator',
    description:
      'Cinematic editorial space-exploration platform and aerospace mission planning system for NASA Lunar South Pole exploration.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${ibmPlexMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#111111] text-[#111111] font-sans antialiased selection:bg-[#F1F52E] selection:text-[#111111]"
      >
        {children}
      </body>
    </html>
  );
}

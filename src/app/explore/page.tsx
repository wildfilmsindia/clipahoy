import { ArchiveHome } from '@/components/ArchiveHome';

/**
 * The archive's front page, for everyone.
 *
 * `/` cannot serve this: once someone has answered the questions it renders
 * their curated feed, and the logo pointed there, so clicking it from inside
 * the feed returned them to the feed. There was no way back out to the whole
 * archive — the search box, the four headline figures, browse by subject and
 * browse by place were all unreachable to the people who had engaged most.
 *
 * Identical for a first-time visitor and a returning one, which is what makes
 * it a sensible destination for the logo.
 */

export const metadata = {
  title: 'Explore the archive',
  description:
    "A virtual smorgasbord of India — search decades of factual footage from South Asia's largest visual archive.",
};

export default function ExplorePage() {
  return <ArchiveHome />;
}

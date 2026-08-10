/**
 * Step: pull every distinct playlist title from the raw cache.
 *
 * No new API calls — playlist titles were already tagged onto every video
 * row during the playlist crawl (item.playlistTitle in ingest.ts), so this
 * is a pure streaming read of the existing 400MB JSONL cache. Only rows
 * fetched via --playlists carry a playlistTitle; the original uploads-crawl
 * rows (the first 20,000) don't, and are skipped here since they contribute
 * nothing to this step.
 */
import { createReadStream, writeFileSync } from 'node:fs';
import readline from 'node:readline';

async function main() {
  const titles = new Set<string>();
  let rowsSeen = 0;
  let rowsWithPlaylist = 0;

  const rl = readline.createInterface({
    input: createReadStream('data/.ingest-cache.jsonl', 'utf8'),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    rowsSeen++;
    try {
      const row = JSON.parse(line);
      const pt = row.playlistTitle;
      if (pt) {
        rowsWithPlaylist++;
        titles.add(pt);
      }
    } catch {
      /* skip torn line */
    }
  }

  const sorted = [...titles].sort();
  writeFileSync('data/audit/playlist-titles.json', JSON.stringify(sorted, null, 2));

  console.log(`rows scanned:        ${rowsSeen}`);
  console.log(`rows with playlist:  ${rowsWithPlaylist}`);
  console.log(`distinct playlists:  ${sorted.length}`);
}

main();

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { getAllClips } from '@/lib/archive';
import { search, termFrequency } from '@/lib/search';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? 'himachal pradesh';

  const cwd = process.cwd();
  const gz = path.join(cwd, 'data', 'index.json.gz');
  const json = path.join(cwd, 'data', 'index.json');
  const bin = path.join(cwd, 'data', 'search-index.bin');

  const results = search(q, 100);

  return Response.json({
    cwd,
    files: {
      'index.json': existsSync(json) ? statSync(json).size : null,
      'index.json.gz': existsSync(gz) ? statSync(gz).size : null,
      'search-index.bin': existsSync(bin) ? statSync(bin).size : null,
    },
    clips: getAllClips().length,
    query: q,
    searchResults: results.length,
    topResults: results.slice(0, 5).map(h => ({ id: h.clip.id, title: h.clip.title, score: h.score })),
    termFreqs: {
      himachal: termFrequency('himachal'),
      pradesh: termFrequency('pradesh'),
    },
  });
}

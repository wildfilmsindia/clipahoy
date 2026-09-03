import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { getAllClips } from '@/lib/archive';

export async function GET() {
  const cwd = process.cwd();
  const gz = path.join(cwd, 'data', 'index.json.gz');
  const json = path.join(cwd, 'data', 'index.json');
  const bin = path.join(cwd, 'data', 'search-index.bin');

  return Response.json({
    cwd,
    files: {
      'index.json': existsSync(json) ? statSync(json).size : null,
      'index.json.gz': existsSync(gz) ? statSync(gz).size : null,
      'search-index.bin': existsSync(bin) ? statSync(bin).size : null,
    },
    clips: getAllClips().length,
  });
}

/**
 * Scores the search layer against scripts/benchmark-queries.json.
 *
 * precision@8 per query, unweighted average across queries. The point is a
 * number that means the same thing between sessions, so relevance rules live
 * in the JSON rather than in whoever is reading the output that day.
 *
 *   npx tsx scripts/benchmark.ts            score the current code
 *   npx tsx scripts/benchmark.ts --verbose  also print every result
 */
import { readFileSync } from 'node:fs';
import { search } from '../src/lib/search';

type Q = { id: string; query: string; source: string; must: string[]; must_not?: string[] };

/*
 * Depth matters. At p@8 every parameter setting scored an identical 97.5% —
 * the top of the list is easy and the metric saturates there. Ranking quality
 * only becomes visible further down, so the headline number is measured at 20.
 */
const K = Number(process.env.BENCH_K ?? 20);
const spec = JSON.parse(readFileSync('scripts/benchmark-queries.json', 'utf8')) as {
  queries: Q[];
};
const verbose = process.argv.includes('--verbose');

let total = 0;
const rows: { id: string; query: string; p: number; n: number }[] = [];

for (const q of spec.queries) {
  const must = q.must.map((m) => new RegExp(m, 'i'));
  const mustNot = (q.must_not ?? []).map((m) => new RegExp(m, 'i'));
  const hits = search(q.query, K);
  const judged = hits.map((h) => {
    const text = `${h.clip.title} ${h.clip.text ?? ''}`;
    return {
      ok: must.every((m) => m.test(text)) && !mustNot.some((m) => m.test(text)),
      title: h.clip.title.slice(0, 72),
    };
  });

  // No results is precision 0: the query returned nothing usable.
  const p = judged.length ? judged.filter((j) => j.ok).length / judged.length : 0;
  total += p;
  rows.push({ id: q.id, query: q.query, p, n: judged.length });

  if (verbose) {
    console.log(`\n${q.query}  (p@${K}=${(p * 100).toFixed(0)}%, ${judged.length} hits)`);
    judged.forEach((j) => console.log(`   ${j.ok ? '+' : '-'} ${j.title}`));
  }
}

console.log(`\nid                 query                          n   p@${K}`);
for (const r of rows) {
  console.log(
    `${r.id.padEnd(18)} ${r.query.padEnd(30)} ${String(r.n).padStart(2)}  ${(r.p * 100).toFixed(0).padStart(3)}%`,
  );
}
console.log(`\nqueries: ${rows.length}`);
console.log(`zero results: ${rows.filter((r) => r.n === 0).length}`);
console.log(`MEAN p@${K}: ${((total / rows.length) * 100).toFixed(1)}%`);

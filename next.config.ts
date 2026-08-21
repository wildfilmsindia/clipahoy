import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * Force the archive into the server bundle.
   *
   * src/lib/archive.ts and src/lib/search.ts build their paths at runtime
   * (path.join(process.cwd(), 'data', ...)), and Next decides what to deploy by
   * statically tracing file references it can see in the source. A computed
   * path is invisible to that trace, so both files were silently left out and
   * the server crashed on its first request with no useful message.
   *
   * Listed explicitly rather than as `data/**` so a stray 489 MB crawl cache in
   * that directory can never be swept into a deployment.
   */
  outputFileTracingIncludes: {
    '/**': ['./data/index.json.gz', './data/search-index.bin', './data/gazetteer.json'],
  },
};

export default nextConfig;

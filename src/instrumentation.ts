/**
 * Runs once when the server starts, before any request is handled.
 *
 * This is the only place the search index can be built without a visitor
 * paying for it. Warming it at module scope does not work: the search module
 * is not loaded until the first request that needs it, which is exactly the
 * request we are trying to protect.
 */
export async function register() {
  // Skip the edge runtime — the index reads from disk and only exists in Node.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  /*
   * Never let a cold start die here.
   *
   * This runs before any request, so there is no error boundary above it: an
   * exception takes the whole server function down and the platform reports
   * only "an unknown error has occurred". A missing or corrupt archive should
   * surface as a readable error on a page, not as a dead process.
   *
   * Warming is an optimisation — the index builds lazily on first use anyway —
   * so failing here costs latency, not correctness.
   */
  try {
    const { warmIndex } = await import('@/lib/search');
    warmIndex();
  } catch (err) {
    console.error('[instrumentation] Could not warm the search index:', err);
  }
}

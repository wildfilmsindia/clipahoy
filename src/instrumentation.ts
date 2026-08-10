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

  const { warmIndex } = await import('@/lib/search');
  warmIndex();
}

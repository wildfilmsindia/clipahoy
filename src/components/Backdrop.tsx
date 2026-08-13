/**
 * Ambient page backdrop.
 *
 * A flat black page reads as dead, and large dark areas band badly on cheap
 * panels. This lays four very low-opacity radial washes (green, deeper green,
 * a touch of yellow) plus a grain overlay behind everything.
 *
 * Alphas are low on purpose. They must stay readable as a change of light
 * rather than of colour: the moment the green is nameable, footage stops
 * looking like footage and the page starts looking tinted.
 *
 * All layers are fixed and pointer-events-none, so they cost one paint and
 * never participate in layout or hit-testing. The drift animation is a
 * transform only, so it stays on the compositor.
 */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash: green undertone rising from the bottom of the viewport. */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_112%,rgba(18,45,32,0.42),rgba(10,24,18,0.16)_45%,transparent_72%)]" />

      {/* Cool green haze along the top edge, so the header never sits on pure black. */}
      <div className="absolute inset-x-0 top-0 h-[55vh] bg-[radial-gradient(100%_100%_at_50%_0%,rgba(14,36,27,0.30),transparent_70%)]" />

      {/* Upper-left cool green pool. */}
      <div
        className="absolute -top-1/4 -left-1/4 h-[70vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgba(47,125,88,0.10),transparent)] blur-2xl"
        style={{ animation: 'drift 34s ease-in-out infinite' }}
      />

      {/* Right-side warm accent, kept very faint so yellow stays an action colour. */}
      <div
        className="absolute top-1/3 -right-1/4 h-[60vh] w-[60vw] rounded-full bg-[radial-gradient(closest-side,rgba(245,197,24,0.045),transparent)] blur-2xl"
        style={{ animation: 'drift 46s ease-in-out infinite reverse' }}
      />

      {/* Vignette: pulls focus to the centre column. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,transparent_45%,rgba(0,0,0,0.35)_100%)]" />

      <div className="grain absolute inset-0" />
    </div>
  );
}

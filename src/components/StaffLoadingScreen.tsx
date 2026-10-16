/**
 * Neutral staff loading screen shown on server render and the first browser
 * render of a staff route, until the acting role/staff is known from browser
 * storage after hydration. Nothing role-dependent (route-access decisions,
 * role-gated menus, "+ New", crisis counts, audit entries) may render or run
 * before this gate lifts. Patient, advocate and public shells are unaffected.
 * Real sign-in (server-known role) will later remove the need for this gate.
 */
export function StaffLoadingScreen() {
  return (
    <div
      data-density="compact"
      data-testid="staff-loading-screen"
      role="status"
      aria-busy="true"
      aria-label="Loading staff workspace"
      className="flex min-h-[50dvh] flex-col bg-canvas text-ink"
    >
      <div className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
        <div className="h-8 w-24 animate-pulse rounded-md bg-surface-sunk" aria-hidden="true" />
        <div className="ml-auto h-8 w-40 animate-pulse rounded-md bg-surface-sunk" aria-hidden="true" />
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    </div>
  );
}

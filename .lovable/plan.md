## Problem

`/notes-queue` (and any page using `useEhrExt`) throws "Maximum update depth exceeded" and shows the "This page didn't load" error boundary.

## Root cause

In `src/lib/ehr-ext.ts`, the `useEhrExt` hook passes `selector()` directly as the `getSnapshot` argument to `useSyncExternalStore`:

```ts
useSyncExternalStore(subscribe, () => { void version; return selector(); }, selector)
```

Selectors like `AdelanteEHRExt.listUnsignedCompletedAppts()` return a **new array reference** on every call. React's `useSyncExternalStore` compares snapshots by identity, sees a fresh reference each check, and schedules another render — infinite loop → error boundary → the "page didn't load" screen.

The sibling `useEhr` in `src/lib/ehr.ts` already dodges this by subscribing to the stable `version` number and calling the selector outside the store. `useEhrExt` needs the same treatment.

## Fix

Rewrite `useEhrExt` in `src/lib/ehr-ext.ts` to mirror the `useEhr` pattern:

```ts
export function useEhrExt<T>(selector: () => T): T {
  useSyncExternalStore(
    (cb) => subscribe(cb),
    () => version,
    () => version,
  );
  return selector();
}
```

## Verify

Reload `/notes-queue` and `/admin-claims` (both consume `useEhrExt`); confirm the pages render, no "Maximum update depth" in the console, and the error boundary no longer shows.

// Freeze only `Date` (not timers) for a test file so time-of-day logic is
// deterministic. Default: Tue 29 Sep 2026, 08:00 Pacific (15:00 UTC) — a
// morning slot, so orders created "now" still have doses left today.
// Import for side effects at the top of a test file.
import { afterAll, beforeAll, vi } from "vitest";

export const FROZEN_NOW = "2026-09-29T15:00:00.000Z";

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(FROZEN_NOW));
});

afterAll(() => {
  vi.useRealTimers();
});

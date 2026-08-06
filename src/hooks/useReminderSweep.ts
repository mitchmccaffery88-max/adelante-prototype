// §Reminders — AUTOMATIC SWEEP (client-side approximation, NOT a real scheduler).
//
// ⚠️ LIMITATION — READ BEFORE RELYING ON THIS ⚠️
// This prototype has no server-side backend, persistence layer, or cron
// infrastructure (the same gap already logged for the scheduling rule
// engine's "background execution once real backend exists"). What follows is
// a browser `setInterval` that runs ONLY while someone has the app open in a
// tab. It is a demo/prototype approximation of automation, nothing more.
//
// A production reminder scheduler MUST run server-side on a scheduled job, so
// reminders fire regardless of whether any browser has the app open. Do not
// describe this to users as a background service, and do not build on top of
// it as if delivery were guaranteed.
//
// No send logic lives here. This is a trigger only: it calls the exact same
// `sendDueReminders()` the manual "Send due reminders" button on /admin calls,
// so the two paths can never diverge. `sendDueReminders` is idempotent per
// contact, so a sweep firing right after a manual click sends nothing twice.
import { useEffect } from "react";
import { sendDueReminders, type ReminderRun } from "@/lib/reminders";

/** Interval between sweeps. 20 min: often enough to look automatic inside a
 *  48h reminder lead window, rare enough to be cheap. */
export const REMINDER_SWEEP_INTERVAL_MS = 20 * 60 * 1000;

/** The single shared entry point for BOTH the automatic sweep and the manual
 *  button. Never call `sendDueReminders` directly from UI code. */
export function runReminderSweep(): ReminderRun {
  return sendDueReminders();
}

/**
 * Mount once, at app-shell level, so the sweep is not tied to any one route:
 * one run on mount, then every `intervalMs`. Silent by design — an automatic
 * sweep must not toast at whoever happens to have the tab open.
 */
export function useReminderSweep(intervalMs = REMINDER_SWEEP_INTERVAL_MS) {
  useEffect(() => {
    const tick = () => {
      try {
        runReminderSweep();
      } catch {
        // A reminder sweep must never break the app shell it lives in.
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

// §Build A item 4 — the appointment prep tip and the join-call decision, in
// one place so Home's next-appointment card and the Appointments list say the
// same thing. Pure: no store, no vendor call.
import { telehealth } from "@/lib/vendors";

export type ApptModality = "video" | "phone" | "in_person";

/** Anything unset is video — that is what the booking form defaults to. */
export function apptModality(modality?: string): ApptModality {
  return (modality as ApptModality) ?? "video";
}

export function apptPrepTip(modality?: string): string {
  switch (apptModality(modality)) {
    case "in_person":
      return "Prep tip: give yourself extra time for the trip, and bring your ID if you have it.";
    case "phone":
      return "Prep tip: pick somewhere you won't be overheard, and keep your phone charged.";
    default:
      return "Prep tip: test your camera a few minutes early and find a private spot.";
  }
}

/** Join opens 15 minutes early and stays open until the visit should be over. */
export const JOIN_WINDOW_BEFORE_MS = 15 * 60_000;

export function joinWindowState(
  start: string,
  durationMin: number,
  now: Date = new Date(),
): "early" | "open" | "over" {
  const t = now.getTime();
  const s = new Date(start).getTime();
  if (t < s - JOIN_WINDOW_BEFORE_MS) return "early";
  if (t > s + durationMin * 60_000) return "over";
  return "open";
}

/**
 * The join URL for a video visit.
 *
 * `Appointment.videoUrl` is the real field a live vendor would populate; today
 * nothing writes it, so we fall back to the existing telehealth adapter seam
 * (`src/lib/vendors/telehealth.ts`), which is currently the deterministic MOCK
 * vendor. That is why the button is labelled as a demo room rather than
 * pretending a real call is waiting.
 */
export function apptJoinUrl(appt: { id: string; videoUrl?: string }): {
  url: string;
  real: boolean;
} {
  if (appt.videoUrl) return { url: appt.videoUrl, real: true };
  return { url: telehealth.getJoinUrl(appt.id, "patient"), real: false };
}

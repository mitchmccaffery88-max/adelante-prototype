// §Onboarding rework (Mitch's audit) — one place for the "not yet intaked"
// rules so the shell, the guard and the craving button can't drift.
import type { Patient } from "@/lib/ehr";

type P = Pick<Patient, "intakeCompletedAt" | "consents"> | undefined | null;

/** First intake not yet submitted → slim onboarding shell, no full nav. */
export function needsFirstIntake(p: P): boolean {
  return Boolean(p) && !p!.intakeCompletedAt;
}

/**
 * Onboarding complete = first intake submitted AND required consent signed
 * (HIPAA acknowledged with a signature timestamp). Part 2 SUD consent is
 * optional by design, so it is not required here.
 */
export function isOnboardingComplete(p: P): boolean {
  return Boolean(p?.intakeCompletedAt && p.consents?.hipaa && p.consents?.signedAt);
}

/** Patient-shell routes a not-yet-intaked person may still open. */
export const PRE_INTAKE_ALLOWED_ROUTES = ["/intake", "/home", "/crisis", "/consent"] as const;

/** Where to send a not-yet-intaked person, or null when the path is allowed. */
export function preIntakeRedirect(pathname: string): string | null {
  return (PRE_INTAKE_ALLOWED_ROUTES as readonly string[]).includes(pathname) ? null : "/intake";
}

import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { needsFirstIntake, preIntakeRedirect } from "@/lib/onboarding";

/**
 * §Onboarding rework — a person who hasn't finished their first intake can't
 * deep-link into the full portal. Mounted only on patient-shell routes; staff,
 * advocate and public routes are never touched. Replace, so Back doesn't loop.
 */
export function OnboardingGuard() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const pending = useEhr(() => needsFirstIntake(AdelanteEHR.getPatient(AdelanteEHR.getCurrentPatientId())));
  useEffect(() => {
    if (!pending) return;
    const to = preIntakeRedirect(pathname);
    if (to && to !== pathname) void navigate({ to, replace: true });
  }, [pending, pathname, navigate]);
  return null;
}

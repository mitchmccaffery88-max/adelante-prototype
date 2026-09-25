// §Part B1 — "What are you looking for?" and what it is allowed to shape.
//
// It shapes CONTENT, RESOURCES and RECOMMENDATIONS only. It never changes
// which screeners are offered (a clinical decision), and it never adds a goal
// to the care plan (suggestions only, accepted by a clinician).
import type { Patient } from "@/lib/ehr";
import { SCREENERS, type ScreenerDef } from "@/lib/screeners";
import { canAccess, type StaffRole } from "@/lib/roles";
import { advocatePart2Masked } from "@/lib/advocate";

/**
 * Intake's screener list — unchanged from before Part B. Depends ONLY on the
 * Part 2 SUD consent answer; the "looking for" answers are deliberately not an
 * input, so screening still catches what people don't volunteer.
 */
export function intakeScreeners(effectiveSud: boolean | null): ScreenerDef[] {
  return SCREENERS.filter((s) => !s.isSud || effectiveSud === true);
}

export type SeekingViewer = { kind: "staff"; role: StaffRole } | { kind: "advocate" };

/**
 * The substance-use selection, as a given viewer may see it. Advocates are
 * always masked (the unconditional default); staff follow the same live
 * `screeners_sud` gate as the SUD screeners.
 */
export function visibleSeekingSubstanceUse(
  patient: Patient | undefined,
  viewer: SeekingViewer,
): boolean | undefined {
  if (!patient) return undefined;
  if (viewer.kind === "advocate") return advocatePart2Masked() ? undefined : undefined;
  const gate = canAccess(viewer.role, "screeners_sud", patient);
  if (gate.level === "none" || gate.locked) return undefined;
  return Boolean(patient.needs?.substanceUse);
}

/**
 * Recovery Journey is shown unless the person answered "looking for" without
 * substance use. Records that never answered keep today's behaviour.
 */
export function recoveryJourneyVisible(p: Pick<Patient, "seeking" | "needs"> | undefined): boolean {
  if (!p?.seeking) return true;
  return Boolean(p.needs?.substanceUse);
}

export interface Recommendation {
  id: string;
  title: { en: string; es: string };
  body: { en: string; es: string };
  to: "/library" | "/recovery-journey" | "/resources" | "/home" | "/medications";
  hash?: string;
}

/** Content picked from the About You answers. Spanish pending review. */
export function recommendationsFor(p: Patient | undefined): Recommendation[] {
  if (!p) return [];
  const out: Recommendation[] = [];
  const ji = p.coverage?.justiceInvolvement === "yes";
  if (p.seeking?.mentalHealth) {
    out.push({
      id: "mh-library",
      title: { en: "Coping skills", es: "Herramientas para sobrellevar" },
      body: { en: "Short exercises for stress, sleep and hard moments.", es: "Ejercicios cortos para el estrés, el sueño y los momentos difíciles." },
      to: "/library",
    });
  }
  if (p.seeking?.medication) {
    out.push({
      id: "med",
      title: { en: "Your medications", es: "Sus medicamentos" },
      body: { en: "Keep track of what you take and ask questions before your visit.", es: "Lleve la cuenta de lo que toma y haga preguntas antes de su cita." },
      to: "/medications",
    });
  }
  if (recoveryJourneyVisible(p) && p.seeking && p.needs?.substanceUse) {
    out.push({
      id: "recovery",
      title: { en: "Recovery journey", es: "Camino de recuperación" },
      body: { en: "Work through recovery modules at your own pace.", es: "Avance en los módulos de recuperación a su ritmo." },
      to: "/recovery-journey",
    });
  }
  if (ji) {
    out.push({
      id: "first-days-out",
      title: { en: "My First Days Out", es: "Mis primeros días afuera" },
      body: { en: "Getting a floor under you after release.", es: "Cómo estabilizarse después de salir." },
      to: "/recovery-journey",
    });
    out.push({
      id: "obligations",
      title: { en: "Your obligations", es: "Sus obligaciones" },
      body: { en: "Court dates, check-ins and conditions in one place.", es: "Fechas de corte, reportes y condiciones en un solo lugar." },
      to: "/home",
      hash: "obligations",
    });
  }
  return out;
}

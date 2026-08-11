// §Adelante Journey Phase 6 — Obligations (PO check-ins, court dates, drug
// tests, mandated treatment and classes).
//
// SCOPE, STATED PLAINLY: this pass is INFORMATIONAL and PATIENT-FACING only.
// There is no supervision/compliance backend here — nothing reports a missed
// check-in to a probation officer, nothing is an authoritative record of
// compliance, and "completed" means the person ticked it off for themselves.
// Any real supervision integration is a much larger, separate decision.
//
// Placement follows the Phase 5 engagement precedent: an obligation is a
// justice-system fact about a person's week, not clinical documentation, so it
// lives in its own store keyed by `patientId` as a foreign reference rather
// than as a field on the clinical `Patient` record. Population gating is
// Phase 2's, applied in the UI with `PopulationGate` and enforced again here.
import { isPopulationAllowed, resolvePopulation } from "@/lib/population";

export type ObligationKind = "po_check_in" | "court" | "drug_test" | "treatment" | "class";

export const OBLIGATION_LABEL: Record<ObligationKind, string> = {
  po_check_in: "PO check-in",
  court: "Court date",
  drug_test: "Drug test",
  treatment: "Mandated treatment",
  class: "Mandated class",
};

export interface Obligation {
  id: string;
  patientId: string;
  kind: ObligationKind;
  title: string;
  /** ISO datetime — when it happens. */
  when: string;
  location?: string;
  notes?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  /** Who entered it. Patient-entered in this pass; no external feed exists. */
  enteredBy: "patient" | "staff";
}

const rows = new Map<string, Obligation[]>();
let seq = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeObligations(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The gate, in one place: justice-involved populations only, confirmed. */
export function obligationsAvailable(patientId: string | undefined): boolean {
  if (!patientId) return false;
  return isPopulationAllowed(resolvePopulation(patientId), [
    "pre_release_ji",
    "post_release_ji",
  ]);
}

export function listObligations(patientId: string): Obligation[] {
  if (!obligationsAvailable(patientId)) return [];
  return [...(rows.get(patientId) ?? [])]
    .map((o) => ({ ...o }))
    .sort((a, b) => a.when.localeCompare(b.when));
}

export function upcomingObligations(patientId: string, asOf = new Date()): Obligation[] {
  const iso = asOf.toISOString();
  return listObligations(patientId).filter((o) => !o.completed && o.when >= iso);
}

export function addObligation(input: {
  patientId: string;
  kind: ObligationKind;
  title: string;
  when: string;
  location?: string;
  notes?: string;
  enteredBy?: Obligation["enteredBy"];
}): Obligation | undefined {
  if (!obligationsAvailable(input.patientId)) return undefined;
  const title = input.title.trim();
  if (!title || !input.when) return undefined;
  const o: Obligation = {
    id: `obl_${++seq}`,
    patientId: input.patientId,
    kind: input.kind,
    title,
    when: input.when,
    location: input.location?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    completed: false,
    createdAt: new Date().toISOString(),
    enteredBy: input.enteredBy ?? "patient",
  };
  rows.set(input.patientId, [...(rows.get(input.patientId) ?? []), o]);
  notify();
  return { ...o };
}

export function setObligationCompleted(
  patientId: string,
  id: string,
  completed: boolean,
): Obligation | undefined {
  if (!obligationsAvailable(patientId)) return undefined;
  const list = rows.get(patientId);
  const o = list?.find((x) => x.id === id);
  if (!o) return undefined;
  o.completed = completed;
  o.completedAt = completed ? new Date().toISOString() : undefined;
  notify();
  return { ...o };
}

export function removeObligation(patientId: string, id: string): void {
  const list = rows.get(patientId);
  if (!list) return;
  rows.set(patientId, list.filter((o) => o.id !== id));
  notify();
}

export function __resetObligations(): void {
  rows.clear();
  seq = 0;
}
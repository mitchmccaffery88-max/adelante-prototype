/**
 * §Dashboard Standardization Phase 5b — global staff patient lookup.
 *
 * HONESTY: this is a CONVENIENCE, not an access boundary. It searches every
 * patient in the program. Rows assigned to the viewer are ranked first (the
 * same assignment identity Phase 1g uses for the caseload default view), but
 * nothing is filtered out and nothing here restricts what a role may open —
 * record-level access is still decided by `canAccess` inside the chart.
 * Real caseload-based access enforcement remains an open production
 * requirement (SculptSoft `86bc4a5d5`).
 */
import { isAssignedTo, type AssignmentIdentity } from "./caseloadScope";

export interface SearchablePatient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  programId?: string | undefined;
  cin?: string | undefined;
  caseManagerId?: string | undefined;
  primaryClinicianId?: string | undefined;
}

export interface PatientSearchResult<T extends SearchablePatient = SearchablePatient> {
  patient: T;
  /** Which field produced the match — shown so the result is explainable. */
  matchedOn: "name" | "dob" | "programId" | "cin";
  /** True when the patient is assigned to the viewer (ranking only). */
  assigned: boolean;
}

const norm = (v: string) => v.trim().toLowerCase();
/** Identifiers are compared without punctuation so "ADL 2026 001" still hits. */
const loose = (v: string) => norm(v).replace(/[^a-z0-9]/g, "");

/**
 * Accepts the stored ISO form (1990-04-02) plus the way staff actually type a
 * date of birth (04/02/1990, 4-2-1990). Returns every comparable form.
 */
function dobForms(dob: string): string[] {
  const iso = dob.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return [loose(iso)];
  const [, y, mm, dd] = m;
  return [loose(iso), loose(`${mm}/${dd}/${y}`), loose(`${Number(mm)}/${Number(dd)}/${y}`)];
}

function matchField<T extends SearchablePatient>(
  patient: T,
  q: string,
): PatientSearchResult<T>["matchedOn"] | undefined {
  const text = norm(q);
  const id = loose(q);
  const name = norm(`${patient.firstName} ${patient.lastName}`);
  const reversed = norm(`${patient.lastName} ${patient.firstName}`);
  if (name.includes(text) || reversed.includes(text)) return "name";
  if (id && dobForms(patient.dob).some((f) => f.includes(id))) return "dob";
  if (id && patient.programId && loose(patient.programId).includes(id)) return "programId";
  if (id && patient.cin && loose(patient.cin).includes(id)) return "cin";
  return undefined;
}

/**
 * Ranked matches for a typed query. Empty/1-character queries return nothing:
 * a single letter matches most of the program and is not a useful lookup.
 */
export function searchPatients<T extends SearchablePatient>(
  patients: T[],
  query: string,
  identity: AssignmentIdentity = {},
  limit = 8,
): PatientSearchResult<T>[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const results: PatientSearchResult<T>[] = [];
  for (const patient of patients) {
    const matchedOn = matchField(patient, q);
    if (!matchedOn) continue;
    results.push({ patient, matchedOn, assigned: isAssignedTo(patient, identity) });
  }
  results.sort((a, b) => {
    if (a.assigned !== b.assigned) return a.assigned ? -1 : 1;
    return `${a.patient.lastName} ${a.patient.firstName}`.localeCompare(
      `${b.patient.lastName} ${b.patient.firstName}`,
    );
  });
  return results.slice(0, limit);
}

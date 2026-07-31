// §Population health Phase 2 — CalAIM eligibility.
//
// Pure computation over records that already exist: Problems (ICD-10) and
// Bookings (release timestamps). No new storage, no claims feed — this is
// eligibility *visibility* only.
//
// Matching interpretation (asked about explicitly): a qualifying code matches
// a problem when the problem's ICD-10 code equals the qualifying code OR
// begins with it at a code boundary. "F10" therefore matches F10, F10.20 and
// F1020, but never F100 — CalAIM lists are routinely published as category
// prefixes, and a naive `startsWith` would let "F10" swallow unrelated
// categories. An exact full code like "F11.20" still matches only itself.
import {
  AdelanteEHR,
  isProblemClinicallyActive,
  type Booking,
  type CalaimQualifyingCode,
  type Patient,
  type Problem,
} from "./ehr";

/** Strip dots/whitespace and upper-case so "f10.20" and "F1020" compare equal. */
function norm(code: string | undefined | null): string {
  return (code ?? "").replace(/[.\s]/g, "").toUpperCase();
}

export type CalaimMatchKind = "exact" | "prefix";

export interface CalaimMatch {
  code: CalaimQualifyingCode;
  kind: CalaimMatchKind;
}

/** Match a single ICD-10 code against one qualifying code. */
export function matchQualifyingCode(
  icd10Code: string | undefined,
  qualifying: CalaimQualifyingCode,
): CalaimMatchKind | null {
  const a = norm(icd10Code);
  const b = norm(qualifying.code);
  if (!a || !b) return null;
  if (a === b) return "exact";
  return a.startsWith(b) ? "prefix" : null;
}

/** First qualifying code that matches, exact matches preferred over prefixes. */
export function firstMatch(
  icd10Code: string | undefined,
  codes: CalaimQualifyingCode[],
): CalaimMatch | null {
  let prefix: CalaimMatch | null = null;
  for (const code of codes) {
    const kind = matchQualifyingCode(icd10Code, code);
    if (kind === "exact") return { code, kind };
    if (kind === "prefix" && !prefix) prefix = { code, kind };
  }
  return prefix;
}

export interface CalaimCaseloadRow {
  patientId: string;
  patientName: string;
  problemId: string;
  problemDescription: string;
  icd10Code: string;
  matchedCode: string;
  matchKind: CalaimMatchKind;
}

/**
 * Every patient with at least one clinically-active Problem whose ICD-10 code
 * matches an active qualifying code. One row per matching problem, so a
 * co-occurring patient shows each qualifying condition.
 */
export function calaimEligiblePatients(
  patients: Patient[] = AdelanteEHR.listPatients(),
  codes: CalaimQualifyingCode[] = AdelanteEHR.listQualifyingCodes(),
): CalaimCaseloadRow[] {
  if (codes.length === 0) return [];
  const rows: CalaimCaseloadRow[] = [];
  for (const p of patients) {
    for (const pr of (p.problems ?? []) as Problem[]) {
      if (!isProblemClinicallyActive(pr)) continue;
      const hit = firstMatch(pr.icd10Code, codes);
      if (!hit) continue;
      rows.push({
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        problemId: pr.id,
        problemDescription: pr.description,
        icd10Code: pr.icd10Code ?? "",
        matchedCode: hit.code.code,
        matchKind: hit.kind,
      });
    }
  }
  return rows.sort((a, b) => a.patientName.localeCompare(b.patientName));
}

export interface CalaimDischargeRow {
  patientId: string;
  patientName: string;
  bookingId: string;
  bookingNumber: string;
  facilityName: string;
  releasedAt: string;
  icd10Code: string;
  problemDescription: string;
  matchedCode: string;
  matchKind: CalaimMatchKind;
}

/**
 * Bookings released inside the trailing window where the patient has — or
 * ever had — a qualifying problem. Deliberately NOT restricted to clinically
 * active problems: the signal is "this person leaving custody has a
 * CalAIM-qualifying condition and needs a handoff", which stays true for a
 * resolved or soft-deleted historical diagnosis.
 */
export function calaimEligibleDischarges(
  windowHours = 24,
  patients: Patient[] = AdelanteEHR.listPatients(),
  codes: CalaimQualifyingCode[] = AdelanteEHR.listQualifyingCodes(),
  now = new Date(),
): CalaimDischargeRow[] {
  if (codes.length === 0) return [];
  const from = now.getTime() - windowHours * 3600_000;
  const rows: CalaimDischargeRow[] = [];
  for (const p of patients) {
    const everMatched = ((p.problems ?? []) as Problem[])
      .map((pr) => ({ pr, hit: firstMatch(pr.icd10Code, codes) }))
      .filter((x) => x.hit);
    if (everMatched.length === 0) continue;
    const best = everMatched[0]!;
    for (const b of (p.bookings ?? []) as Booking[]) {
      if (!b.releasedAt) continue;
      const at = Date.parse(b.releasedAt);
      if (!Number.isFinite(at) || at < from || at > now.getTime()) continue;
      rows.push({
        patientId: p.id,
        patientName: `${p.firstName} ${p.lastName}`,
        bookingId: b.id,
        bookingNumber: b.bookingNumber,
        facilityName: b.facilityName,
        releasedAt: b.releasedAt,
        icd10Code: best.pr.icd10Code ?? "",
        problemDescription: best.pr.description,
        matchedCode: best.hit!.code.code,
        matchKind: best.hit!.kind,
      });
    }
  }
  return rows.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
}

/** Distinct patient count behind the caseload rows. */
export function distinctPatients(rows: { patientId: string }[]): number {
  return new Set(rows.map((r) => r.patientId)).size;
}

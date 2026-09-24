// §Pre-release pipeline — internal-staff CSV import of partner-supplied
// pre-release roster data.
//
// The real channel today is a CF Care Manager (who usually works for the
// correctional facility, not for Adelante, and often has no account here)
// sending a list by protected email to somebody internal. This module is the
// honest version of that: an internal person drops the file in, sees exactly
// what would happen, and commits it.
//
// Deliberately NOT built here:
//  - no machine feed. If the channel ever stops being human-mediated, a real
//    ingestion endpoint would parse into `previewPreReleaseRoster` and reuse
//    `classifyRosterRow` unchanged — that is the seam. It is not stubbed now,
//    because a stub that nothing calls is just a lie about readiness.
//  - no medical-record columns. Diagnoses, medications and clinical history
//    are a separate question with its own consent story.
//
// Pure: this file parses and classifies. It never writes.

import { parseCsvLine } from "@/lib/credentialRoster";

export const PRE_RELEASE_HRSN_COLUMNS = [
  "hrsn_housing",
  "hrsn_food",
  "hrsn_transportation",
  "hrsn_utilities",
  "hrsn_safety",
] as const;

export const PRE_RELEASE_CSV_COLUMNS = [
  "first_name",
  "last_name",
  "dob",
  "anticipated_release_date",
  "county_of_release",
  "facility_name",
  "booking_number",
  ...PRE_RELEASE_HRSN_COLUMNS,
  // §Phase 8b — optional; applied as partner_reported, never verified.
  "cin",
  "coverage_type",
] as const;

/** §Phase 8b — accepted coverage_type values (the shared step's choices). */
export const PRE_RELEASE_COVERAGE_TYPES = [
  "medi_cal",
  "dual",
  "medicare",
  "private_insurance",
  "no_insurance",
  "other",
  "unknown",
] as const;
export type PreReleaseCoverageType = (typeof PRE_RELEASE_COVERAGE_TYPES)[number];

/** The only columns a row cannot do without. */
const REQUIRED_COLUMNS = ["first_name", "last_name", "dob", "anticipated_release_date"] as const;

export const HRSN_DOMAIN_LABELS: Record<string, string> = {
  housing: "Housing instability & quality",
  food: "Food insecurity",
  transportation: "Transportation",
  utilities: "Utility needs",
  safety: "Interpersonal safety",
};

export const PRE_RELEASE_IMPORT_NOTE =
  "The HRSN columns record whether a domain came back positive — yes, no, or blank for not screened. They are stored as partner-reported, never as a screening administered here, because the question-by-question answers are not in the file.";

export type RosterOutcome = "created" | "matched" | "skipped" | "rejected";

export interface RosterCandidate {
  line: number;
  firstName: string;
  lastName: string;
  dob: string;
  anticipatedReleaseDate: string;
  county?: string;
  facilityName?: string;
  bookingNumber?: string;
  /** Domain positivity as supplied. Absent domains were left blank (not screened). */
  hrsn: { key: string; label: string; positive: boolean }[];
  /** §Phase 8b — partner-reported benefits (optional columns). */
  cin?: string;
  coverageType?: PreReleaseCoverageType;
  outcome: Exclude<RosterOutcome, "rejected">;
  /** Set when the row matched an existing patient. */
  patientId?: string;
  /** Plain-language explanation of the outcome, shown per row in the preview. */
  reason: string;
}

export interface RosterRejection {
  line: number;
  name: string;
  reason: string;
}

export interface RosterPreview {
  candidates: RosterCandidate[];
  rejections: RosterRejection[];
  /** File-level failure (empty file, bad header). Nothing else is parsed. */
  fatal?: string;
}

export interface KnownPatient {
  id: string;
  firstName: string;
  lastName: string;
  dob?: string;
  /** The person's open pre-release episode, if any. */
  openEpisode?: { id: string; anticipatedReleaseDate: string };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Older than this and an "anticipated" release date is almost certainly a typo. */
const MAX_PAST_DAYS = 365;

const norm = (s: string) => s.trim().toLowerCase();

function parseYesNo(raw: string | undefined): boolean | undefined | "invalid" {
  const v = norm(raw ?? "");
  if (!v) return undefined;
  if (["yes", "y", "true", "1", "positive"].includes(v)) return true;
  if (["no", "n", "false", "0", "negative"].includes(v)) return false;
  return "invalid";
}

export function preReleaseCsvTemplate(): string {
  return [
    PRE_RELEASE_CSV_COLUMNS.join(","),
    "Maria,Alvarez,1990-04-12,2026-10-15,Fresno,Fresno County Jail,BK-44821,yes,yes,no,,no,91234567A,medi_cal",
  ].join("\n");
}

/**
 * Classify one already-parsed row against the real roster. Exported because it
 * is the whole decision, and it is worth testing without a CSV around it.
 */
export function classifyRosterRow(
  row: {
    line: number;
    firstName: string;
    lastName: string;
    dob: string;
    anticipatedReleaseDate: string;
    county?: string;
    facilityName?: string;
    bookingNumber?: string;
    hrsn: { key: string; label: string; positive: boolean }[];
    cin?: string;
    coverageType?: PreReleaseCoverageType;
  },
  known: KnownPatient[],
): RosterCandidate | RosterRejection {
  const name = `${row.firstName} ${row.lastName}`.trim();
  const match = known.find(
    (p) =>
      norm(p.firstName) === norm(row.firstName) &&
      norm(p.lastName) === norm(row.lastName) &&
      (p.dob ?? "").slice(0, 10) === row.dob,
  );
  if (!match) {
    return {
      ...row,
      outcome: "created",
      reason: "New record and pre-release episode.",
    };
  }
  if (
    match.openEpisode &&
    match.openEpisode.anticipatedReleaseDate === row.anticipatedReleaseDate
  ) {
    return {
      ...row,
      outcome: "skipped",
      patientId: match.id,
      reason: "Already has an open episode with this release date — nothing to change.",
    };
  }
  return {
    ...row,
    outcome: "matched",
    patientId: match.id,
    reason: match.openEpisode
      ? "Existing record — the open episode's details will be updated."
      : "Existing record — a pre-release episode will be opened.",
  };
}

/**
 * Parse and validate a roster CSV. Returns what WOULD happen; writes nothing.
 * Every rejected row comes back with a specific reason rather than vanishing.
 */
export function previewPreReleaseRoster(
  csv: string,
  known: KnownPatient[],
  today: Date = new Date(),
): RosterPreview {
  const candidates: RosterCandidate[] = [];
  const rejections: RosterRejection[] = [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { candidates, rejections, fatal: "That file is empty." };

  const header = parseCsvLine(lines[0]!).map((h) => norm(h));
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return {
      candidates,
      rejections,
      fatal: `The header row is missing: ${missing.join(", ")}. Expected columns: ${PRE_RELEASE_CSV_COLUMNS.join(", ")}.`,
    };
  }
  if (lines.length === 1) {
    return { candidates, rejections, fatal: "That file has a header row but no people in it." };
  }

  const pick = (cells: string[], name: string): string | undefined => {
    const i = header.indexOf(name);
    if (i < 0) return undefined;
    return cells[i]?.trim() || undefined;
  };

  const seen = new Set<string>();
  const cutoff = new Date(today.getTime() - MAX_PAST_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  for (let i = 1; i < lines.length; i += 1) {
    const line = i + 1;
    const cells = parseCsvLine(lines[i]!);
    const firstName = pick(cells, "first_name") ?? "";
    const lastName = pick(cells, "last_name") ?? "";
    const name = `${firstName} ${lastName}`.trim() || "(no name)";
    const dob = pick(cells, "dob") ?? "";
    const release = pick(cells, "anticipated_release_date") ?? "";

    if (!firstName || !lastName) {
      rejections.push({ line, name, reason: "A first and last name are both required." });
      continue;
    }
    if (!dob) {
      rejections.push({ line, name, reason: "Date of birth is missing." });
      continue;
    }
    if (!ISO_DATE.test(dob)) {
      rejections.push({ line, name, reason: `Date of birth "${dob}" must be YYYY-MM-DD.` });
      continue;
    }
    if (!release) {
      rejections.push({ line, name, reason: "Anticipated release date is missing." });
      continue;
    }
    if (!ISO_DATE.test(release)) {
      rejections.push({
        line,
        name,
        reason: `Anticipated release date "${release}" must be YYYY-MM-DD.`,
      });
      continue;
    }
    if (release < cutoff) {
      rejections.push({
        line,
        name,
        reason: `Anticipated release date "${release}" is more than a year in the past — check the file.`,
      });
      continue;
    }
    const dupeKey = `${norm(firstName)}|${norm(lastName)}|${dob}`;
    if (seen.has(dupeKey)) {
      rejections.push({ line, name, reason: "This person appears earlier in the same file." });
      continue;
    }

    const hrsn: { key: string; label: string; positive: boolean }[] = [];
    let badDomain: string | undefined;
    for (const col of PRE_RELEASE_HRSN_COLUMNS) {
      const key = col.replace("hrsn_", "");
      const parsed = parseYesNo(pick(cells, col));
      if (parsed === "invalid") {
        badDomain = col;
        break;
      }
      if (parsed === undefined) continue; // blank means not screened, not "no".
      hrsn.push({ key, label: HRSN_DOMAIN_LABELS[key] ?? key, positive: parsed });
    }
    if (badDomain) {
      rejections.push({
        line,
        name,
        reason: `${badDomain} must be yes, no, or left blank for not screened.`,
      });
      continue;
    }

    const rawCin = (pick(cells, "cin") ?? "").replace(/\s+/g, "").toUpperCase();
    if (rawCin && !/^[A-Z0-9]{9}$/.test(rawCin)) {
      rejections.push({ line, name, reason: `cin "${rawCin}" must be 9 letters or digits, or left blank.` });
      continue;
    }
    const rawType = norm(pick(cells, "coverage_type") ?? "");
    if (rawType && !(PRE_RELEASE_COVERAGE_TYPES as readonly string[]).includes(rawType)) {
      rejections.push({
        line,
        name,
        reason: `coverage_type "${rawType}" must be one of ${PRE_RELEASE_COVERAGE_TYPES.join(", ")}, or left blank.`,
      });
      continue;
    }

    seen.add(dupeKey);
    const result = classifyRosterRow(
      {
        line,
        firstName,
        lastName,
        dob,
        anticipatedReleaseDate: release,
        ...(pick(cells, "county_of_release") ? { county: pick(cells, "county_of_release") } : {}),
        ...(pick(cells, "facility_name") ? { facilityName: pick(cells, "facility_name") } : {}),
        ...(pick(cells, "booking_number") ? { bookingNumber: pick(cells, "booking_number") } : {}),
        hrsn,
        ...(rawCin ? { cin: rawCin } : {}),
        ...(rawType ? { coverageType: rawType as PreReleaseCoverageType } : {}),
      },
      known,
    );
    if ("outcome" in result) candidates.push(result);
    else rejections.push(result);
  }

  return { candidates, rejections };
}

export function rosterCounts(preview: RosterPreview) {
  return {
    created: preview.candidates.filter((c) => c.outcome === "created").length,
    matched: preview.candidates.filter((c) => c.outcome === "matched").length,
    skipped: preview.candidates.filter((c) => c.outcome === "skipped").length,
    rejected: preview.rejections.length,
  };
}

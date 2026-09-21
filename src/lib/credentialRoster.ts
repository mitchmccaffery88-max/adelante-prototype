// §EHR audit Phase 2b — credential roster import / export.
//
// Deliberately narrow: this moves the credential FACTS (who, what kind,
// number, state, dates) in and out as CSV. It never carries the stored
// document — a base64 PDF has no business in a spreadsheet, and Phase 2a's
// upload path is the only way a real document is attached.
//
// Import is preview-first: nothing is written until the caller confirms, and
// every rejected row comes back with a reason rather than being dropped.

export const CREDENTIAL_CSV_COLUMNS = [
  "clinician_id",
  "clinician_name",
  "kind",
  "number",
  "issuing_state",
  "issued_at",
  "expires_at",
  "status",
  "verified_at",
  "has_document",
] as const;

export const CREDENTIAL_IMPORT_COLUMNS = [
  "clinician_id",
  "kind",
  "number",
  "issuing_state",
  "issued_at",
  "expires_at",
] as const;

export const CREDENTIAL_KINDS = [
  "license",
  "dea",
  "malpractice",
  "board_cert",
  "caqh",
  "other",
] as const;

export const CREDENTIAL_IMPORT_NOTE =
  "CSV only, and documents are never included — a licence scan still has to be uploaded on the credential itself.";

export interface RosterRow {
  id: string;
  clinicianId: string;
  clinicianName: string;
  kind: string;
  number?: string;
  issuingState?: string;
  issuedAt?: string;
  expiresAt?: string;
  status: string;
  verifiedAt?: string;
  hasDocument: boolean;
}

function csvCell(v: string | undefined): string {
  const s = v ?? "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCredentialCsv(rows: RosterRow[]): string {
  const lines = [CREDENTIAL_CSV_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.clinicianId,
        r.clinicianName,
        r.kind,
        r.number,
        r.issuingState,
        r.issuedAt,
        r.expiresAt,
        r.status,
        r.verifiedAt,
        r.hasDocument ? "yes" : "no",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

/** Minimal RFC4180-ish splitter — handles quoted cells and embedded commas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ImportCandidate {
  line: number;
  clinicianId: string;
  kind: string;
  number?: string;
  issuingState?: string;
  issuedAt?: string;
  expiresAt?: string;
  /** Set when this matches an existing credential (same clinician + kind + number). */
  existingId?: string;
  action: "add" | "update";
}

export interface ImportProblem {
  line: number;
  message: string;
}

export interface ImportPreview {
  candidates: ImportCandidate[];
  problems: ImportProblem[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse and validate a CSV against the real roster. Returns what WOULD happen;
 * it writes nothing. A row that matches an existing clinician + kind + number
 * is an update, everything else is an add.
 */
export function previewCredentialImport(
  csv: string,
  known: { clinicianIds: string[]; existing: { id: string; clinicianId: string; kind: string; number?: string }[] },
): ImportPreview {
  const candidates: ImportCandidate[] = [];
  const problems: ImportProblem[] = [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { candidates, problems: [{ line: 0, message: "That file is empty." }] };
  }
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const missing = CREDENTIAL_IMPORT_COLUMNS.filter(
    (c) => c !== "number" && c !== "issuing_state" && c !== "issued_at" && !header.includes(c),
  );
  if (missing.length) {
    return {
      candidates,
      problems: [
        {
          line: 1,
          message: `The header row is missing: ${missing.join(", ")}. Expected columns: ${CREDENTIAL_IMPORT_COLUMNS.join(", ")}.`,
        },
      ],
    };
  }
  const idx = (name: string) => header.indexOf(name);
  const pick = (cells: string[], name: string): string | undefined => {
    const i = idx(name);
    if (i < 0) return undefined;
    return cells[i]?.trim() || undefined;
  };

  for (let i = 1; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const cells = parseCsvLine(lines[i]!);
    const clinicianId = pick(cells, "clinician_id");
    const kind = (pick(cells, "kind") ?? "").toLowerCase();
    const expiresAt = pick(cells, "expires_at");
    const issuedAt = pick(cells, "issued_at");

    if (!clinicianId) {
      problems.push({ line: lineNo, message: "No clinician id." });
      continue;
    }
    if (!known.clinicianIds.includes(clinicianId)) {
      problems.push({ line: lineNo, message: `No clinician with id "${clinicianId}".` });
      continue;
    }
    if (!CREDENTIAL_KINDS.includes(kind as (typeof CREDENTIAL_KINDS)[number])) {
      problems.push({
        line: lineNo,
        message: `"${kind || "(blank)"}" isn't a credential type. Use one of: ${CREDENTIAL_KINDS.join(", ")}.`,
      });
      continue;
    }
    for (const [label, value] of [
      ["issued_at", issuedAt],
      ["expires_at", expiresAt],
    ] as const) {
      if (value && !ISO_DATE.test(value)) {
        problems.push({ line: lineNo, message: `${label} "${value}" must be YYYY-MM-DD.` });
      }
    }
    if ((issuedAt && !ISO_DATE.test(issuedAt)) || (expiresAt && !ISO_DATE.test(expiresAt))) continue;

    const number = pick(cells, "number");
    const match = known.existing.find(
      (e) =>
        e.clinicianId === clinicianId &&
        e.kind === kind &&
        (e.number ?? "") === (number ?? ""),
    );
    candidates.push({
      line: lineNo,
      clinicianId,
      kind,
      number,
      issuingState: pick(cells, "issuing_state"),
      issuedAt,
      expiresAt,
      existingId: match?.id,
      action: match ? "update" : "add",
    });
  }
  return { candidates, problems };
}

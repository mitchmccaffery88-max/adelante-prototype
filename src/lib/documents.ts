// §v3.0 Phase 5 — Patient file upload & chart population: PURE POLICY.
//
// Same discipline as `advocate.ts`: no store access, no React, no I/O. Facts
// in, decision out, so every gate below is testable in isolation and cannot
// grow a side effect. `ehr.ts` supplies the live facts.
//
// ============================================================================
// STORAGE HONESTY FLAG — READ BEFORE EXTENDING (dev-team follow-up, REAL WORK)
// ============================================================================
// This prototype does NOT store files. `PatientDocument` records METADATA
// only: a name, a MIME type, a byte count, who uploaded it and how it was
// classified. No file bytes are persisted anywhere, and nothing here is
// encrypted, because there is nothing to encrypt.
//
// What a production build genuinely requires, and what this prototype cannot
// meaningfully implement or simulate:
//   - encrypted object storage (KMS-managed keys, encryption at rest and in
//     transit) inside the organization's AWS compliance perimeter / BAA scope;
//   - signed, short-lived, per-object access URLs rather than ambient reads;
//   - a real anti-malware engine on the ingest path (see the scan gate below,
//     which is a REAL gate with a DETERMINISTIC STUB ENGINE behind it);
//   - retention, legal-hold and secure-destruction policy on the objects.
// Do not read the presence of this module as evidence any of that exists.
// Same honesty pattern as the client-side reminder scheduler and the advocate
// prototype session.
// ============================================================================

/** Who performed the upload. Never collapsed into a generic "unverified" flag. */
export type DocumentUploaderKind = "patient" | "advocate" | "staff";

export type DocumentVerificationStatus = "unverified" | "verified" | "rejected";

/**
 * PLACEHOLDER SET. What documents a patient realistically possesses at release
 * is an OPEN QUESTION for Christi — this list is a working affordance so the
 * upload form has something to say, not a researched taxonomy. Do not treat it
 * as a requirement, and do not build routing logic that depends on a value.
 */
export const DOCUMENT_TYPES: { key: string; label: string }[] = [
  { key: "identification", label: "Identification (placeholder)" },
  { key: "coverage", label: "Insurance / Medi-Cal paperwork (placeholder)" },
  { key: "release_paperwork", label: "Release paperwork (placeholder)" },
  { key: "outside_records", label: "Records from another provider (placeholder)" },
  { key: "other", label: "Something else" },
];

// ----- Malware scan gate ----------------------------------------------------

export interface UploadCandidate {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /**
   * Optional leading text of the file, when the caller can cheaply read it.
   * Used only by the stub engine's signature check (EICAR).
   */
  contentSample?: string;
}

export type MalwareScanResult =
  | { clean: true }
  | { clean: false; threat: string; reason: string };

/** Industry-standard harmless test signature — the file every scanner flags. */
export const EICAR_SIGNATURE =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** Extensions that never belong in a patient chart and are rejected outright. */
const BLOCKED_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "scr", "pif", "msi", "dll", "js", "jse",
  "vbs", "vbe", "ps1", "sh", "jar", "apk", "hta",
];

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * The ingest gate. A NON-CLEAN result MUST reject the upload before any record
 * is created — the store enforces that, and a test proves a flagged file never
 * lands. The engine itself is a deterministic stub (signature + extension +
 * size); a real engine is a dev-team follow-up, see the header flag.
 */
export function scanUpload(file: UploadCandidate): MalwareScanResult {
  const name = file.fileName.trim();
  if (!name) return { clean: false, threat: "invalid", reason: "The file has no name." };
  if (file.sizeBytes <= 0)
    return { clean: false, threat: "empty_file", reason: "That file is empty." };
  if (file.sizeBytes > MAX_UPLOAD_BYTES)
    return {
      clean: false,
      threat: "oversize",
      reason: "That file is larger than 15 MB. Please send a smaller copy.",
    };

  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (BLOCKED_EXTENSIONS.includes(ext))
    return {
      clean: false,
      threat: "blocked_executable",
      reason: `Files of type .${ext} can't be uploaded to a patient record.`,
    };
  // Double-extension smuggling: report.pdf.exe already caught above; this
  // catches report.pdf.exe.txt style padding.
  if (BLOCKED_EXTENSIONS.some((e) => name.toLowerCase().includes(`.${e}.`)))
    return {
      clean: false,
      threat: "blocked_executable",
      reason: "That file name looks like a disguised program and was rejected.",
    };

  if (file.contentSample && file.contentSample.includes(EICAR_SIGNATURE))
    return {
      clean: false,
      threat: "eicar_test_signature",
      reason: "This file was flagged by the malware scan and was not accepted.",
    };

  return { clean: true };
}

// ----- Verify-queue ownership ----------------------------------------------

/**
 * Ownership follows the patient's episode, not a manual assignment: while a
 * pre-release episode is OPEN the CF Care Manager owns the patient's paperwork
 * (Phase 2); once released/closed — or if there never was an episode — the ECM
 * Provider does. One rule, derived, so a queue can never be orphaned.
 */
export function verifyQueueOwnerRole(
  episodeStatus: "open" | "released" | "closed" | undefined,
): "cf_care_manager" | "ecm_provider" {
  return episodeStatus === "open" ? "cf_care_manager" : "ecm_provider";
}

// ----- Part 2 restriction messaging ----------------------------------------

export const PART2_RESTRICTED_MESSAGE =
  "This document requires a Part 2 disclosure authorization to view — not currently on file. Ask the person you're supporting, or their care team, about signing one.";

/**
 * §Group D item 4 — the deliberate MIRROR of `PART2_RESTRICTED_MESSAGE`, for
 * the unmasked case. Same "here is exactly what is going on" discipline: an
 * advocate should never assume Part 2 detail is theirs by default, so when it
 * IS visible the reason is named on screen.
 */
export const PART2_DISCLOSED_MESSAGE =
  "Substance-use service details are visible because an active Part 2 disclosure authorization naming advocate disclosure is on file. This is not default access — it stops the moment that authorization is revoked.";
export const PART2_DISCLOSED_BADGE_LABEL = "Part 2 disclosure on file";

/**
 * Advocate-side visibility for ONE document. Restricted ≠ hidden: the row
 * still appears (consistent with masked group topics still showing as "Group
 * session"), with a specific explanation of what is missing.
 *
 * `part2Unmasked` is the Phase 4 two-check result — valid link AND an active
 * `advocate_sud_disclosure` ConsentRecord — passed in, never recomputed here.
 */
export function advocateDocumentVisibility(facts: {
  isPart2: boolean;
  part2Unmasked: boolean;
}): { restricted: boolean; restrictionMessage?: string } {
  if (!facts.isPart2) return { restricted: false };
  if (facts.part2Unmasked) return { restricted: false };
  return { restricted: true, restrictionMessage: PART2_RESTRICTED_MESSAGE };
}

// ----- §Group E item 2 — download / view: ONE gate, not two -----------------
//
// The download action deliberately has NO authorization logic of its own. It
// calls `advocateDocumentVisibility` — the exact function the restricted
// RENDERING case uses — and refuses whenever that says "restricted". The only
// thing this adds on top is the chart-membership rule (an unverified document
// is not chart content, so there is nothing to hand over yet). If the Part 2
// rule ever changes, both surfaces change together because there is only one
// implementation. A test asserts the shared call, not just the shared outcome.

export const DOWNLOAD_UNVERIFIED_MESSAGE =
  "This document hasn't been reviewed yet, so it isn't part of the medical record and can't be opened.";

export type DocumentDownloadDecision =
  | { allowed: true }
  | { allowed: false; reason: string; restricted: boolean };

export function documentDownloadDecision(facts: {
  isPart2: boolean;
  part2Unmasked: boolean;
  verification: DocumentVerificationStatus;
}): DocumentDownloadDecision {
  // Part 2 FIRST, and via the rendering gate itself: a document an advocate
  // cannot see must not leak its existence-shaped detail through a different
  // refusal message.
  const vis = advocateDocumentVisibility({
    isPart2: facts.isPart2,
    part2Unmasked: facts.part2Unmasked,
  });
  if (vis.restricted)
    return {
      allowed: false,
      reason: vis.restrictionMessage ?? PART2_RESTRICTED_MESSAGE,
      restricted: true,
    };
  if (facts.verification !== "verified")
    return { allowed: false, reason: DOWNLOAD_UNVERIFIED_MESSAGE, restricted: false };
  return { allowed: true };
}

/**
 * What actually comes back from a download. STORAGE HONESTY: there are no file
 * bytes anywhere in this prototype, so the "file" handed to the browser is the
 * document's own metadata record, plainly labelled as such. It is a real,
 * functional download of a real record — it is not a copy of the original file,
 * and nothing here should be read as evidence that one exists.
 */
export function documentDownloadPayload(doc: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docType?: string;
  uploadedAt: string;
  uploaderLabel: string;
  isPart2: boolean;
  promotedBy?: string;
  promotedAt?: string;
}): { fileName: string; mimeType: string; text: string } {
  const lines = [
    "ADELANTE — DOCUMENT RECORD (metadata only)",
    "",
    "This prototype does not store file contents. No copy of the original",
    "file exists. What follows is the record kept about it.",
    "",
    `Document id:      ${doc.id}`,
    `Original name:    ${doc.fileName}`,
    `Type:             ${doc.mimeType}`,
    `Size as sent:     ${doc.sizeBytes} bytes`,
    `Category:         ${doc.docType ?? "—"}`,
    `Uploaded:         ${doc.uploadedAt}`,
    `Uploaded by:      ${doc.uploaderLabel}`,
    `42 CFR Part 2:    ${doc.isPart2 ? "yes — redisclosure protected" : "no"}`,
    `Verified by:      ${doc.promotedBy ?? "—"}`,
    `Verified at:      ${doc.promotedAt ?? "—"}`,
  ];
  return {
    fileName: `${doc.fileName.replace(/\.[^.]+$/, "")}-record.txt`,
    mimeType: "text/plain",
    text: lines.join("\n"),
  };
}

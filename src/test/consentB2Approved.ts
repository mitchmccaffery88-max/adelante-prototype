// B2-1 (Mitch, Oct 21, delegated approval) — the ONLY approved source changes
// to src/lib/ehr.ts since the parity rollbacks: the additive consent record
// model extension. Parity tests apply these exact substitutions to the
// rollback text; anything else must still match byte-for-byte. Each anchor
// must match exactly once or this throws.
const B2: [string, string][] = [
  // 1. consentRecordModel import
  [
    'import { disclose } from "./part2Disclosure";\n',
    'import { disclose } from "./part2Disclosure";\nimport { recipientKey, validateConsentExtension, verbalAssentAllowed, type ConsentRecordExtension, type ConsentType } from "./consentRecordModel";\n',
  ],
  // 2. ConsentRecord extends the extension
  ["export interface ConsentRecord {", "export interface ConsentRecord extends ConsentRecordExtension {"],
  // 3. activeConsentRecord: untyped records only
  [
    `  /** The single record currently in force for a patient, if any. */
  activeConsentRecord(patientId: string, at = new Date()): ConsentRecord | undefined {
    return consentRecords.find(
      (r) => r.patientId === patientId && !r.needsReviewAfterMerge && effectiveConsentStatus(r, at) === "active",
    );`,
    `  /**
   * The single untyped (pre-B2) record currently in force for a patient, if
   * any. §B2-1 typed records live beside it and are read by the B2-1 coverage check.
   */
  activeConsentRecord(patientId: string, at = new Date()): ConsentRecord | undefined {
    return consentRecords.find(
      (r) => r.patientId === patientId && !r.consentType && !r.needsReviewAfterMerge && effectiveConsentStatus(r, at) === "active",
    );`,
  ],
  // 4. legacy fallback: untyped records only
  [
    "    const has = consentRecords.some((r) => r.patientId === patientId && !r.needsReviewAfterMerge);",
    "    const has = consentRecords.some((r) => r.patientId === patientId && !r.consentType && !r.needsReviewAfterMerge);",
  ],
  // 5. consentCovers (not wired into any gate until B2-4)
  [
    `    if (!rec) return false;
    return Boolean(rec.sections.find((s) => s.category === category)?.authorized);
  },
  createConsentRecord(input: {`,
    `    if (!rec) return false;
    return Boolean(rec.sections.find((s) => s.category === category)?.authorized);
  },
  /**
   * §B2-1 — does a typed record cover this use, evaluated live (no caching)?
   * Denies expired, revoked, superseded and legacyUnverified records; verbal
   * assent covers only the allowed types. Not wired into any gate until B2-4.
   */
  consentCovers(
    patientId: string,
    q: { type: ConsentType; recipient?: string; purpose?: string; item?: string; at?: Date },
  ): boolean {
    const at = q.at ?? new Date();
    return consentRecords.some((r) => {
      if (r.patientId !== patientId || r.consentType !== q.type) return false;
      if (r.needsReviewAfterMerge || r.legacyUnverified || r.expiryEventOccurredAt) return false;
      if (effectiveConsentStatus(r, at) !== "active") return false;
      if (r.signature?.method === "verbal_assent" && !verbalAssentAllowed(q.type, r.purposeCode)) return false;
      if (q.recipient) {
        const want = q.recipient.trim().toLowerCase();
        if (!r.recipients?.some((x) => (x.directoryRef ?? "").toLowerCase() === want || x.name.trim().toLowerCase() === want)) return false;
      }
      if (q.purpose && r.purposeCode !== q.purpose && r.purpose !== q.purpose) return false;
      if (q.item && r.items && !r.items.includes(q.item)) return false;
      return true;
    });
  },
  createConsentRecord(input: {`,
  ],
  // 6. extension input on createConsentRecord
  [
    `    supersedesId?: string;
  }): ConsentRecord {`,
    `    supersedesId?: string;
    extension?: ConsentRecordExtension;
  }): ConsentRecord {`,
  ],
  // 7. extension validation
  [
    `    if (!input.effectiveDate) throw new Error("An effective date is required.");
    const now = new Date().toISOString();`,
    `    if (!input.effectiveDate) throw new Error("An effective date is required.");
    const ext = input.extension;
    const extErrors = ext ? validateConsentExtension(ext) : [];
    if (extErrors.length) throw new Error(extErrors.join(" "));
    const now = new Date().toISOString();`,
  ],
  // 8. typed records supersede only within the same type + recipient key
  [
    `    // A new record supersedes whatever was in force — history is preserved.
    const prior = AdelanteEHR.activeConsentRecord(input.patientId);`,
    `    // A new record supersedes whatever was in force — history is preserved.
    // §B2-1: typed records supersede only within the same type + recipient key.
    const prior = ext?.consentType
      ? consentRecords.find(
          (r) =>
            r.patientId === input.patientId &&
            r.consentType === ext.consentType &&
            recipientKey(r.recipients) === recipientKey(ext.recipients) &&
            effectiveConsentStatus(r) === "active",
        )
      : AdelanteEHR.activeConsentRecord(input.patientId);`,
  ],
  // 9. extension fields spread onto the record
  [
    `      supersedesId: input.supersedesId ?? prior?.id,
      sections: input.sections,
    };`,
    `      supersedesId: input.supersedesId ?? prior?.id,
      sections: input.sections,
      ...(ext ?? {}),
    };`,
  ],
];

/** Rollback text with only the approved B2-1 substitutions applied (each must match exactly once). */
export function withApprovedConsentB2(path: string, rollbackText: string): string {
  if (path !== "src/lib/ehr.ts") return rollbackText;
  let s = rollbackText;
  for (const [from, to] of B2) {
    if (s.split(from).length !== 2) throw new Error(`Approved B2-1 anchor not found once in ${path}`);
    s = s.replace(from, to);
  }
  return s;
}

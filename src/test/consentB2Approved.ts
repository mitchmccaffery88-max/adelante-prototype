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
  // 10. §B2-3 — typed-record revocation store method (no domain audit; the registry action is the one event)
  [
    `    emit();
    return rec;
  },
  /**
   * §ASCMI disclosure trail — fired when consent-gated content is actually`,
    `    emit();
    return rec;
  },
  /**
   * §B2-3 — revoke a TYPED consent record. Writes NO domain audit: the
   * registry action (consent_record_revoke / consent_record_patient_revoke)
   * is the single audit event for the write. Nothing is deleted.
   */
  revokeTypedConsentRecord(
    recordId: string,
    input: { by: string; role: string; method: "portal" | "in_person" | "phone" | "written"; reason: string; onBehalfOfPatient: boolean },
  ): ConsentRecord {
    const rec = consentRecords.find((r) => r.id === recordId);
    if (!rec) throw new Error("Consent record not found.");
    if (!rec.consentType) throw new Error("Only typed consent records use this flow.");
    if (rec.status === "revoked") throw new Error("This record is already revoked.");
    const at = new Date().toISOString();
    rec.status = "revoked";
    rec.revokedAt = at;
    rec.revokedBy = input.by;
    rec.revocationReason = input.reason;
    rec.revocation = { by: input.by, at, method: input.method, reason: input.reason, onBehalfOfPatient: input.onBehalfOfPatient };
    emit();
    return rec;
  },
  /**
   * §ASCMI disclosure trail — fired when consent-gated content is actually`,
  ],
  // §B2-6 (Mitch, Oct 22) — additive consent event metadata + disclosure-link lookup.
  // B2-6.1
  [
    "import { recipientKey, validateConsentExtension, verbalAssentAllowed, type ConsentRecordExtension, type ConsentType } from \"./consentRecordModel\";\n",
    "import { recipientKey, validateConsentExtension, verbalAssentAllowed, type ConsentRecordExtension, type ConsentType } from \"./consentRecordModel\";\nimport { consentEventDetail, createEventDetail, type ConsentEventName } from \"./consentEvents\";\n",
  ],
  // B2-6.2
  [
    "    extension?: ConsentRecordExtension;\n  }): ConsentRecord {",
    "    extension?: ConsentRecordExtension;\n    /** \u00a7B2-6 \u2014 neutral consent event name for the existing audit entry (derived when omitted). */\n    consentEvent?: ConsentEventName;\n  }): ConsentRecord {",
  ],
  // B2-6.3
  [
    "        categories: rec.sections.filter((s) => s.authorized).map((s) => s.category),\n      },\n    });",
    "        categories: rec.sections.filter((s) => s.authorized).map((s) => s.category),\n        ...createEventDetail(rec, input.capturedBy.role, input.consentEvent, prior?.id),\n      },\n    });",
  ],
  // B2-6.4
  [
    "      detail: { consentRecordId: rec.id, formType: rec.formType, reason: rec.revocationReason },",
    "      detail: { consentRecordId: rec.id, formType: rec.formType, reason: rec.revocationReason, ...consentEventDetail({ name: \"consent.revoked\", rec, actorRole: input.role }) },",
  ],
  // B2-6.5
  [
    "      if (q.item && r.items && !r.items.includes(q.item)) return false;\n      return true;\n    });\n  },\n",
    "      if (q.item && r.items && !r.items.includes(q.item)) return false;\n      return true;\n    });\n  },\n  /**\n   * \u00a7B2-6 \u2014 read-only: the typed record that covers a use, or null. Decided by\n   * consentCovers (same predicate); used only to LINK disclosures, never to\n   * block or allow one. Enforcement is B2-4.\n   */\n  consentCoveringRecordId(\n    patientId: string,\n    q: { type: ConsentType; recipient?: string; purpose?: string; item?: string; at?: Date },\n  ): string | null {\n    if (!AdelanteEHR.consentCovers(patientId, q)) return null;\n    const at = q.at ?? new Date();\n    const want = q.recipient?.trim().toLowerCase();\n    const rec = consentRecords.find((r) =>\n      r.patientId === patientId && r.consentType === q.type &&\n      !r.needsReviewAfterMerge && !r.legacyUnverified && !r.expiryEventOccurredAt &&\n      effectiveConsentStatus(r, at) === \"active\" &&\n      !(r.signature?.method === \"verbal_assent\" && !verbalAssentAllowed(q.type, r.purposeCode)) &&\n      (!want || !!r.recipients?.some((x) => (x.directoryRef ?? \"\").toLowerCase() === want || x.name.trim().toLowerCase() === want)) &&\n      (!q.purpose || r.purposeCode === q.purpose || r.purpose === q.purpose) &&\n      (!q.item || !r.items || r.items.includes(q.item)));\n    return rec?.id ?? null;\n  },\n  /** \u00a7B2-6 \u2014 append a disclosure id to a typed record's disclosureIds (link only; no audit, no access change). */\n  linkConsentDisclosure(recordId: string, disclosureId: string): void {\n    const rec = consentRecords.find((r) => r.id === recordId);\n    if (!rec) return;\n    if (!rec.disclosureIds) rec.disclosureIds = [];\n    if (!rec.disclosureIds.includes(disclosureId)) rec.disclosureIds.push(disclosureId);\n  },\n",
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

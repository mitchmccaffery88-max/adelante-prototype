import { withApprovedMoudServiceOct28 } from "./moudServiceOct28Approved";
import { withApprovedCoverageRulesOct29 } from "./coverageRulesOct29Approved";
import { withApprovedPatientSchedulingOct29 } from "./patientSchedulingOct29Approved";
import { withApprovedPatientSchedulingOct30 } from "./patientSchedulingOct30Approved";
import { withApprovedFamilyRequestOct30 } from "./familyRequestOct30Approved";
import { withApprovedScreenerCompletenessOct30 } from "./screenerCompletenessOct30Approved";
import { withApprovedCredentialingDeaOct28 } from "./credentialingDeaOct28Approved";
import { withApprovedCredentialingReconciliationOct28 } from "./credentialingReconciliationOct28Approved";
import { withApprovedAccessRulesOct28 } from "./accessRulesOct28Approved";
import { withApprovedCredentialingAsOfOct28 } from "./credentialingAsOfOct28Approved";
import { withApprovedSignupOct26 } from "./signupOct26Approved";
// 27 Oct credentialing batch (Mitch) — the ONLY approved source changes to the
// pinned files for the clinician-credentialing batch:
//  • src/lib/ehr.ts — imports the ONE credentialing rule, adds the
//    bookingCredentialingBlock helper + hard-stop inside bookAppointment, and
//    rebooks the seeded p1 visit with the enrolled prescriber (Dr. Bagga's
//    exclusion check is intentionally overdue in the demo).
//  • src/lib/ehr-ext.ts — c2's seeded license document expiry aligns with the
//    credentialing record's 25-day expiry so the old table and the new tiles
//    tell one story.
//  • src/routes/billing.tsx — Billing's Credentialing tab gains the derived
//    review-flag list (counts and neutral labels only).
// Parity tests apply these exact substitutions to the rollback text; anything
// else must still match byte-for-byte. Each anchor must match exactly once or
// this throws.

const EHR_OCT27: [string, string][] = [
  // 1. import the ONE credentialing rule
  [
    'import { bookingRightFor, canScheduleRole, checkBookingRights, isPrescriberServiceType } from "./bookingRights";',
    'import { bookingRightFor, canScheduleRole, checkBookingRights, isPrescriberServiceType } from "./bookingRights";\nimport { credentialedForService, isBillableServiceType, CREDENTIALING_NEUTRAL_LABEL } from "./credentialing";',
  ],
  // 2. the bookingCredentialingBlock helper
  [
    // 27 Oct clinician credentialing batch: exact existing clinician-fit anchor only.
    '/** Prescriber / MAT visits → physician or PMHNP calendars; SUD types → a calendar that offers them. */',
    `/**
 * 27 Oct (Mitch) — credentialing booking block (Draft — pending go-live
 * permissions audit and compliance review). Returns the neutral scheduler
 * message when the rendering clinician fails the ONE credentialing rule for
 * this payer + service type, or undefined when booking may proceed. Runs only
 * when the patient's payer is known (active coverage plan) and the service is
 * billable — coverage verification is a separate readiness item, and
 * non-billable support work is never blocked. Existing appointments and
 * claims are flagged for Billing review (credentialingReviewFlags), never
 * cancelled or deleted.
 */
export function bookingCredentialingBlock(
  clinicianId: string,
  serviceType: string | undefined,
  patientId: string,
  start: string,
): string | undefined {
  if (!isBillableServiceType(serviceType)) return undefined;
  const member = STAFF_ROSTER.find((s) => s.clinicianId === clinicianId);
  if (!member) return undefined;
  const payer = AdelanteEHR.activeCoveragePlan(patientId)?.payer;
  if (!payer) return undefined;
  const res = credentialedForService(member.id, payer, serviceType, start);
  return res.ok ? undefined : "This clinician can't be booked for this service right now.";
}

/** Prescriber / MAT visits → physician or PMHNP calendars; SUD types → a calendar that offers them. */`,
  ],
  // 3. the hard-stop inside bookAppointment
  [
    '    const cred = AdelanteEHR.canBook(input.clinicianId);\n    if (!cred.ok) throw new Error(cred.reason);',
    `    const cred = AdelanteEHR.canBook(input.clinicianId);
    if (!cred.ok) throw new Error(cred.reason);
    // 27 Oct (Mitch) — credentialing hard-stop (Draft): a clinician who fails
    // the "credentialed for this service" rule can't be booked for NEW
    // billable services for that payer. Non-billable support work continues;
    // existing appointments are flagged for Billing review, never cancelled.
    const credBlock = bookingCredentialingBlock(input.clinicianId, input.serviceType, input.patientId, input.start);
    if (credBlock) throw new Error(credBlock);`,
  ],
  // 4. the seeded p1 visit books with the enrolled prescriber
  [
    '  book(demoScenarioPatientId("sud_consented"), "c5", 60, "med_management");\n  book("p1", "c5", 150, "med_management");',
    `  book(demoScenarioPatientId("sud_consented"), "c5", 60, "med_management");
  // 27 Oct credentialing (Draft): p1 has active Medi-Cal FFS coverage and
  // Dr. Bagga's exclusion check is overdue, so the ONE credentialing rule
  // blocks a NEW p1 booking with c5. The demo visit books with the other
  // enrolled prescriber instead; Dr. Bagga keeps his uncovered-patient visit.
  book("p1", "c3", 150, "med_management");`,
  ],
];

const EHREXT_OCT27: [string, string][] = [
  [
    '    clinicianId: "c2",\n    kind: "license",\n    issuingState: "CA",\n    number: "PMHNP-32101",\n    expiresAt: daysFromNow(45),',
    '    clinicianId: "c2",\n    kind: "license",\n    issuingState: "CA",\n    number: "PMHNP-32101",\n    // 27 Oct — aligned with the credentialing record\'s 25-day expiry so the\n    // old document table and the new credentialing tiles tell one story.\n    expiresAt: daysFromNow(25),',
  ],
];

const BILLING_OCT27: [string, string][] = [
  // 1. imports for the derived review flags
  [
    'import { staffCoversService } from "@/lib/bookingRights";',
    'import { staffCoversService } from "@/lib/bookingRights";\nimport { credentialingReviewFlags, CREDENTIALING_REASON_LABEL } from "@/lib/credentialing";',
  ],
  // 2. derived flags memo after the claims memo
  [
    '  const claims = useMemo(() => {\n    if (posting) return [];\n    const open = billingProjection("open");\n    const denied = billingProjection("denied");\n    return { open, denied };\n  }, [posting]);',
    `  const claims = useMemo(() => {
    if (posting) return [];
    const open = billingProjection("open");
    const denied = billingProjection("denied");
    return { open, denied };
  }, [posting]);
  // 27 Oct (Mitch) credentialing — derived Billing review flags: appointments
  // and claims whose rendering clinician fails the ONE rule are listed for
  // review, never cancelled or deleted. Draft — pending go-live audit.
  const credFlags = useMemo(
    () => credentialingReviewFlags(AdelanteEHR.listAppointments(), AdelanteEHR.listClaims()),
    [posting],
  );`,
  ],
  // 3. the flags card inside the Credentialing tab
  [
    '              <CardHeader>\n                <CardTitle className="text-base">Credentialing roster</CardTitle>\n                <CardDescription>\n                  Import, review, and export clinician licenses and registrations. Import uses the same column headers the export produces,\n                  so a downloaded CSV can be edited and re-imported. Document bytes stay in the credential record; the CSV records whether a\n                  document is on file.\n                </CardDescription>\n              </CardHeader>',
    `              <CardHeader>
                <CardTitle className="text-base">Credentialing roster</CardTitle>
                <CardDescription>
                  Import, review, and export clinician licenses and registrations. Import uses the same column headers the export produces,
                  so a downloaded CSV can be edited and re-imported. Document bytes stay in the credential record; the CSV records whether a
                  document is on file.
                </CardDescription>
              </CardHeader>
              <CardContent className="border-b pb-4">
                <div className="text-sm font-medium">Billing review — credentialing flags</div>
                <p className="text-xs text-muted-foreground">
                  Existing appointments and claims whose rendering clinician currently fails the credentialing rule. Flagged for review —
                  never cancelled or changed. Draft — pending go-live permissions audit and compliance review.
                </p>
                {credFlags.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No appointments or claims are flagged right now.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {credFlags.map((f) => (
                      <li key={f.kind + f.id} className="text-sm">
                        <span className="font-medium">{f.kind === "claim" ? "Claim" : "Appointment"}</span> · {f.clinicianName} ·{" "}
                        {f.payer} · {f.serviceType} · {new Date(f.dateOfService).toLocaleDateString("en-US")} —{" "}
                        {f.reasons.map((r) => CREDENTIALING_REASON_LABEL[r]).join("; ")}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>`,
  ],
];

/** Rollback text with only the approved 27 Oct credentialing substitutions applied (each must match exactly once). */
export function withApprovedCredentialingOct27(path: string, rollbackText: string): string {
  let s = withApprovedSignupOct26(path, rollbackText);
  const subs =
    path === "src/lib/ehr.ts" ? EHR_OCT27 : path === "src/lib/ehr-ext.ts" ? EHREXT_OCT27 : path === "src/routes/billing.tsx" ? BILLING_OCT27 : [];
  for (const [from, to] of subs) {
    if (s.split(from).length !== 2) throw new Error(`Approved anchor not found once in ${path}`);
    s = s.replace(from, to);
  }
  return withApprovedScreenerCompletenessOct30(path, withApprovedFamilyRequestOct30(path, withApprovedPatientSchedulingOct30(path, withApprovedPatientSchedulingOct29(path, withApprovedCoverageRulesOct29(path, withApprovedMoudServiceOct28(path, withApprovedCredentialingDeaOct28(path, withApprovedCredentialingAsOfOct28(path, withApprovedAccessRulesOct28(path, withApprovedCredentialingReconciliationOct28(path, s))))))))));
}

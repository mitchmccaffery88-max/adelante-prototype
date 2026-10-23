import { AdelanteEHR, type Patient, type ProgressNote } from "@/lib/ehr";
import { AdelanteEHRExt, type ClaimState } from "@/lib/ehr-ext";
import { runActionOrThrow } from "@/lib/actions/runAction";
import { getActingRole, getActingStaff, setActingStaff, type StaffRole } from "@/lib/roles";
import { attestationStatement, buildAttestationRecord } from "@/lib/attestation";
import { ASAM_DIMENSIONS, type AsamAssessment } from "@/lib/asam";
import { demoLocalDayAt } from "@/lib/demoTime";
import { PART2_ELEMENT_KEYS } from "@/lib/consentRecordModel";

/** Opt-in only. Keys are stable; all record IDs come from public creators. */
export const BILLING_LIFECYCLE_KEYS = ["paid", "receipt_balance", "denied", "writeoff_reversed", "blocked", "sliding_fee", "dmc_ods"] as const;
export type BillingLifecycleKey = typeof BILLING_LIFECYCLE_KEYS[number];
export type BillingLifecycleScenario = Record<BillingLifecycleKey, { patientId: string; programId: string; encounterId: string; claimId: string; noteId: string }>;
let loaded: BillingLifecycleScenario | undefined;
let cohort = 0;

const SIGNATURE = { attested: true, signatureDataUrl: "data:image/png;base64,c2ltdWxhdGVk", metrics: { totalLength: 220, strokeCount: 3 } };
const attestation = (key: string, name: string) => buildAttestationRecord({ statement: attestationStatement(key), draft: SIGNATURE, signedBy: name });

function acting(id: string, role: StaffRole) {
  setActingStaff(id, role);
  const staff = getActingStaff();
  return { staffId: staff.id, name: staff.name, role, clinicianId: staff.clinicianId };
}

function action<T>(id: string, via: string, patient: Patient | undefined, ...args: unknown[]): T {
  const staff = getActingStaff();
  return runActionOrThrow<T>(id, { staffId: staff.id, role: getActingRole() }, patient, { via, args });
}

/** A separate rehearsal cohort lets browser tests exercise the same public UI
 * from final documentation onwards, without rewriting seeded terminal claims. */
export function buildBillingLifecycleScenario(options: { complete?: boolean } = {}): BillingLifecycleScenario {
  const previous = getActingStaff();
  const previousRole = getActingRole();
  const complete = options.complete !== false;
  const number = ++cohort;
  const result = {} as BillingLifecycleScenario;
  try {
    for (const [index, key] of BILLING_LIFECYCLE_KEYS.entries()) {
      acting("s-cf2", "cf_care_manager");
      const patient = action<Patient>("patient_create_anyway", "createPatient", undefined, {
        firstName: "Fictional QA", lastName: `Billing ${number} ${key}`, matchSource: "seed",
      });
      acting("s-bill1", "billing");
      action("payment_arrangement", "setPaymentArrangement", patient, patient.id, key === "sliding_fee" ? "sliding_fee" : "self_pay");
      if (key === "dmc_ods") {
        // B2-5: flags grant nothing. One signed treatment-only Part 2 capture
        // (program recipient), signed by this fictional patient today.
        acting("s-cm1", "ecm_provider");
        action("consent_record_capture", "captureConsentRecord", patient, {
          draft: {
            patientId: patient.id, consentType: "part2_tpo_single",
            recipients: [{ kind: "org", name: "Adelante", directoryRef: "adelante-program" }],
            purpose: "treatment", purposeCode: "treatment", items: ["SUD treatment information"],
            part2Elements: Object.fromEntries(PART2_ELEMENT_KEYS.map(k => [k, true])), expiresOnEvent: "Patient revokes this consent",
          },
          method: "e_sign", signer: `${patient.firstName} ${patient.lastName}`, relationship: "patient", attested: true,
          actor: { role: "ecm_provider", staffId: "s-cm1", name: "Luz Herrera" },
        });
        // These are the existing public ASAM panel paths, not internal writes.
        const author = acting("s-tr1", "clinical_trainee");
        const draft = action<AsamAssessment>("asam", "saveAsamDraft", patient, patient.id, {
          dimensions: ASAM_DIMENSIONS.map(d => ({ key: d.key, documentation: "Simulated fictional example. Draft — pending clinical sign-off.", rating: 1 })),
          recommendedLevel: "outpatient", actualLevel: "outpatient", diagnosisCodes: ["F15.20"],
        }, author);
        action("asam", "signAsam", patient, patient.id, draft.id, author, attestation("asam_sign", author.name));
        const supervisor = acting("s-th1", "therapist");
        action("asam", "cosignAsam", patient, patient.id, draft.id, supervisor, attestation("asam_supervisor_sign", supervisor.name));
      }
      const clinician = acting("s-th1", "therapist");
      // Completed historical visits, always at facility business hours.
      let start = demoLocalDayAt(-2 - number, 9, index * 60).toISOString();
      // A previously loaded cohort must not occupy the same clinician slot.
      while (AdelanteEHR.listAppointments().some(a => a.clinicianId === "c1" && a.start === start)) {
        start = new Date(+new Date(start) - 86400000).toISOString();
      }
      const appointment = action<ReturnType<typeof AdelanteEHR.bookAppointment>>("schedule_visit", "bookAppointment", patient, {
        patientId: patient.id, clinicianId: "c1", start, durationMin: 45,
        serviceType: "therapy_individual", modality: "video", bookedBy: { id: clinician.staffId, role: clinician.role },
      });
      action("visit_attended", "markAppointmentAttended", patient, appointment.id,
        { id: clinician.staffId, name: clinician.name, role: clinician.role });
      const claim = AdelanteEHRExt.claimForEncounter(appointment.id);
      if (!claim) throw new Error("Attended visit did not create its claim.");
      const note = action<ProgressNote | undefined>("progress_note", "addProgressNote", patient, patient.id, {
        clinicianId: "c1", appointmentId: appointment.id, date: start, sessionType: "individual",
        subjective: "Simulated fictional visit. Draft — pending clinical sign-off.", objective: "Fictional QA documentation.",
        assessment: "Draft — pending clinical sign-off.", plan: "Fictional QA follow-up.", status: "draft", authorSource: "human",
        templateAnswers: { service_minutes: 45 },
      });
      if (!note) throw new Error("Visit note was not created.");
      if (key !== "blocked") {
        action("progress_note", "signProgressNote", patient, patient.id, note.id, {
          signedBy: clinician.name, signedById: clinician.staffId, role: clinician.role, attested: true,
          attestation: attestation("progress_note_sign", clinician.name),
        });
      }
      acting("s-bill1", "billing");
      // Billing corrections use the existing rate table; no rate or amount is invented.
      action("claim_correct", "correctClaim", patient, claim.id,
        { serviceCode: key === "dmc_ods" ? "H0004" : "90834", program: key === "dmc_ods" ? "dmc_ods" : key === "sliding_fee" ? "sliding_fee" : "self_pay" },
        "Simulated QA rate-table coding");
      const move = (state: ClaimState, reason?: string) => action("claim_status", "transitionClaim", patient, claim.id, state, reason ? { denialReason: reason } : undefined);
      if (complete && key !== "blocked") {
        move("coded"); move("generated");
        if (key !== "sliding_fee" && key !== "dmc_ods") move("submitted");
        if (key === "paid") {
          action("payment_record", "recordPatientPayment", patient, { claimId: claim.id, amountCents: claim.patientBalanceCents, receivedOn: start.slice(0, 10), method: "check", reference: "QA-paid" });
          move("paid");
        } else if (key === "receipt_balance") {
          action("payment_record", "recordPatientPayment", patient, { claimId: claim.id, amountCents: Math.floor((claim.patientBalanceCents ?? 0) / 2), receivedOn: start.slice(0, 10), method: "cash", reference: "QA-receipt" });
        } else if (key === "denied" || key === "writeoff_reversed") {
          move("denied", "Simulated QA denial — incorrect claim information.");
          if (key === "writeoff_reversed") {
            move("written_off", "Simulated QA write-off — reconciliation reviewed.");
            move("generated", "Simulated QA reversal — corrected reconciliation.");
          }
        }
      }
      result[key] = { patientId: patient.id, programId: patient.programId, encounterId: appointment.id, claimId: claim.id, noteId: note.id };
    }
    return result;
  } finally {
    setActingStaff(previous.id, previousRole);
  }
}

export function loadBillingLifecycleScenario(): BillingLifecycleScenario {
  if (loaded && BILLING_LIFECYCLE_KEYS.every(key => AdelanteEHRExt.listClaims().some(c => c.id === loaded?.[key].claimId))) return loaded;
  loaded = buildBillingLifecycleScenario();
  return loaded;
}
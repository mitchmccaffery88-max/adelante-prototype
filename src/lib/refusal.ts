// §MAR Phase 3 — the Refusal legal document.
//
// This is a LEGAL RECORD, not a MAR exception note. The underlying refused
// DoseAdministration (Phase 1) is charted the moment the nurse commits the
// batch and is never blocked by this document — the form is a follow-on legal
// artifact that can be finished later ("Sign later" → pending_signature).
//
// ATTESTATION FIDELITY: like Orders and the MAR batch commit, the nurse's
// identity attestation is CHECKBOX-ONLY. TODO(auth): re-verify with real staff
// credentials once staff authentication exists. Deliberately not a fake
// password field — a fake credential prompt is worse than an honest checkbox.
//
// LANGUAGE: risk text is ENGLISH ONLY in this pass. Adelante has an EN/ES
// toggle elsewhere, but clinical risk-disclosure language in a legal document
// must not be machine-translated. TODO(clinical): Spanish risk text requires
// review/sign-off by Christi and Dr. Bagga before it ships.

import type { MedOrder, Patient, PatientAlert, RefusalForm } from "@/lib/ehr";

export type MedClass = "psychiatric" | "controlled" | "anticoagulant" | "antibiotic" | "*";

export interface RiskTextEntry {
  version: string;
  label: string;
  text: string;
}

/**
 * Static risk-text catalog. The reference EMR fetches this from a server RPC;
 * Adelante has no such RPC, so the equivalent lives here as versioned local
 * data. Every entry carries a version so a future edit is traceable against
 * forms already signed under the previous wording (the snapshot is copied onto
 * the form at creation, so old forms keep the text the patient was actually
 * read).
 */
export const RISK_TEXT_CATALOG: Record<MedClass, RiskTextEntry> = {
  psychiatric: {
    version: "v1",
    label: "Psychiatric medication",
    text: "This medication is prescribed to help stabilize your mood, thinking, or anxiety. Stopping or skipping doses can allow symptoms to return or worsen, sometimes quickly, and can lead to a crisis, hospitalization, or loss of progress you have already made. Some psychiatric medications also cause withdrawal or rebound symptoms if stopped abruptly rather than tapered. You have the right to refuse, and refusing will not affect your access to other care — but your prescriber should know so a safer plan can be made.",
  },
  controlled: {
    version: "v1",
    label: "Controlled substance",
    text: "This is a controlled medication, which means it is closely monitored for safety and for the risk of dependence or misuse. Missing doses can cause withdrawal symptoms, uncontrolled pain, or cravings, and repeated refusals may mean this medication is no longer the right treatment for you. Refusing is your right and will not be treated as misconduct, but it will be documented and your prescriber will be notified so your plan can be reviewed.",
  },
  anticoagulant: {
    version: "v1",
    label: "Blood thinner (anticoagulant)",
    text: "This medication thins your blood to prevent dangerous clots. Even one or two missed doses can raise your risk of a stroke, a clot in the lungs, or a clot in the legs, and those events can be life-threatening or permanently disabling. If you are refusing because of bruising, bleeding, or side effects, tell your nurse now — there may be a safer option. Your refusal will be documented and your prescriber notified immediately.",
  },
  antibiotic: {
    version: "v1",
    label: "Antibiotic",
    text: "This antibiotic treats an active infection. Skipping doses or stopping early can let the infection come back, spread, or become resistant to treatment, which makes it much harder to cure later. Finishing the full course matters even if you already feel better. You may refuse, and your refusal will be documented and reported to your prescriber so the infection can still be managed safely.",
  },
  "*": {
    version: "v1",
    label: "General medication",
    text: "This medication was ordered by your prescriber as part of your treatment plan. Refusing it may allow the condition it treats to worsen, may delay your recovery, and may change what other treatments are safe or available to you. You have the right to refuse any medication. Your refusal will be documented in your chart and your prescriber will be notified so your plan can be reviewed with you.",
  },
};

/**
 * Keyword classifier ported from the reference. Order matters: anticoagulant
 * and controlled are checked before psychiatric because a few agents (e.g.
 * benzodiazepines) read as both and the higher-risk disclosure should win.
 */
export function medClassGuess(drugName: string | undefined | null): MedClass {
  const n = (drugName ?? "").toLowerCase();
  if (!n) return "*";
  if (
    /warfarin|coumadin|apixaban|eliquis|rivaroxaban|xarelto|dabigatran|pradaxa|edoxaban|heparin|enoxaparin|lovenox|clopidogrel|plavix/.test(
      n,
    )
  )
    return "anticoagulant";
  if (
    /buprenorphine|suboxone|zubsolv|methadone|oxycodone|hydrocodone|morphine|fentanyl|hydromorphone|codeine|tramadol|alprazolam|xanax|lorazepam|ativan|clonazepam|klonopin|diazepam|valium|amphetamine|adderall|methylphenidate|ritalin|concerta|phentermine|ketamine|zolpidem|ambien/.test(
      n,
    )
  )
    return "controlled";
  if (
    /sertraline|zoloft|fluoxetine|prozac|escitalopram|lexapro|citalopram|celexa|paroxetine|paxil|venlafaxine|effexor|duloxetine|cymbalta|bupropion|wellbutrin|mirtazapine|remeron|trazodone|lithium|lamotrigine|lamictal|valproate|divalproex|depakote|carbamazepine|quetiapine|seroquel|risperidone|risperdal|olanzapine|zyprexa|aripiprazole|abilify|haloperidol|haldol|ziprasidone|geodon|paliperidone|invega|clozapine|clozaril|hydroxyzine|buspirone|buspar|prazosin|naltrexone|vivitrol/.test(
      n,
    )
  )
    return "psychiatric";
  if (
    /cillin|cephalexin|keflex|ceftriaxone|cefdinir|azithromycin|zithromax|clarithromycin|doxycycline|minocycline|ciprofloxacin|levofloxacin|moxifloxacin|clindamycin|metronidazole|flagyl|vancomycin|nitrofurantoin|macrobid|trimethoprim|sulfamethoxazole|bactrim|linezolid|rifampin|isoniazid|ethambutol|pyrazinamide/.test(
      n,
    )
  )
    return "antibiotic";
  return "*";
}

/**
 * ADAPTATION — NOT A CLEAN PORT.
 *
 * The reference EMR has a dedicated `capacity_flag` record type. Adelante's
 * PatientAlert is a free-text label with no fixed enum (deliberately, per the
 * type's own comment), so capacity is inferred HEURISTICALLY by matching active
 * alert labels against /capacity|guardian|conservator/i. That means:
 *   - an alert worded differently ("unable to consent", "DPOA active") is MISSED
 *   - an unrelated alert containing the word "guardian" is a FALSE POSITIVE
 * The consequence of a miss is that a witness is required when the reference
 * would not have required one — the conservative direction. TODO(clinical):
 * introduce a real capacity flag type and stop guessing at labels.
 */
export const CAPACITY_ALERT_PATTERN = /capacity|guardian|conservator/i;

export function capacityFlagsFrom(alerts: PatientAlert[] | undefined): string[] {
  return (alerts ?? [])
    .filter((a) => a.active && CAPACITY_ALERT_PATTERN.test(a.label))
    .map((a) => a.label);
}

/** Age in whole years at `asOf`, or undefined when the DOB is unusable. */
export function ageYears(dob: string | undefined, asOf: Date = new Date()): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  let age = asOf.getUTCFullYear() - d.getUTCFullYear();
  const m = asOf.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && asOf.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
}

export function isMinorPatient(patient: Pick<Patient, "dob">, asOf?: Date): boolean {
  const age = ageYears(patient.dob, asOf);
  return age !== undefined && age < 18;
}

// ---------------------------------------------------------------------------
// Picker option sets (ported from the reference).
// ---------------------------------------------------------------------------

export const DECLINE_REASONS = [
  "Patient declined to sign",
  "Patient unable to sign (physical)",
  "Patient left before signing",
  "Patient agitated / unsafe to approach",
  "Patient does not wish to document refusal",
] as const;

export const INTERPRETER_METHODS = [
  { value: "in_person", label: "In-person interpreter" },
  { value: "phone", label: "Telephonic interpreter line" },
  { value: "video", label: "Video remote interpreting" },
  { value: "bilingual_staff", label: "Qualified bilingual staff" },
  { value: "not_available", label: "No interpreter available" },
] as const;

/** Reference EMR's escalation deferral reasons. */
export const DEFERRAL_REASONS = [
  "Prescriber already aware — plan unchanged",
  "Follow-up already scheduled",
  "Patient discharging / transferring",
  "Refusals clinically expected for this therapy",
  "Patient re-accepted the medication",
  "Other (documented in note)",
] as const;

export const ESCALATION_DISCIPLINES = [
  { value: "psychiatrist", label: "Psychiatrist / PMHNP" },
  { value: "medical_provider", label: "Medical provider" },
] as const;

export type EscalationDiscipline = (typeof ESCALATION_DISCIPLINES)[number]["value"];

/** Reference default: psychiatric refusals route to psychiatry, everything else to medical. */
export function defaultEscalationDiscipline(medClass: MedClass): EscalationDiscipline {
  return medClass === "psychiatric" ? "psychiatrist" : "medical_provider";
}

/** Provider follow-up must be at least 15 minutes out and no more than 72 hours out. */
export const ESCALATION_MIN_MINUTES = 15;
export const ESCALATION_MAX_HOURS = 72;

export function escalationWindow(now: Date = new Date()): { min: Date; max: Date } {
  return {
    min: new Date(now.getTime() + ESCALATION_MIN_MINUTES * 60_000),
    max: new Date(now.getTime() + ESCALATION_MAX_HOURS * 3600_000),
  };
}

export function validateEscalationTime(
  whenIso: string,
  now: Date = new Date(),
): string | undefined {
  const t = Date.parse(whenIso);
  if (Number.isNaN(t)) return "Pick a follow-up date and time.";
  const { min, max } = escalationWindow(now);
  if (t < min.getTime()) return `Follow-up must be at least ${ESCALATION_MIN_MINUTES} minutes out.`;
  if (t > max.getTime()) return `Follow-up must be within ${ESCALATION_MAX_HOURS} hours.`;
  return undefined;
}

/** Refusals of the SAME order within this window trigger escalation. */
export const ESCALATION_REFUSAL_THRESHOLD = 3;
export const ESCALATION_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Signature capture — anti-tap-fraud thresholds, ported verbatim.
// ---------------------------------------------------------------------------

/** A stroke set below either threshold is a tap or a dot, not a signature. */
export const SIGNATURE_MIN_LENGTH = 40;
export const SIGNATURE_MIN_STROKES = 2;

export interface SignatureMetrics {
  totalLength: number;
  strokeCount: number;
}

export function signatureMetrics(
  strokes: { x: number; y: number }[][] | undefined,
): SignatureMetrics {
  let totalLength = 0;
  for (const stroke of strokes ?? []) {
    for (let i = 1; i < stroke.length; i += 1) {
      totalLength += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    }
  }
  return { totalLength, strokeCount: (strokes ?? []).length };
}

export function isValidSignature(m: SignatureMetrics): boolean {
  return m.totalLength >= SIGNATURE_MIN_LENGTH && m.strokeCount >= SIGNATURE_MIN_STROKES;
}

// ---------------------------------------------------------------------------
// Finalize validation — ported faithfully from the reference's canFinalize.
// ---------------------------------------------------------------------------

export type PatientMode = "signed" | "declined";

export interface RefusalFinalizePayload {
  nurseAttested: boolean;
  nurseSignatureDataUrl?: string;
  nurseNote?: string;
  patientMode?: PatientMode;
  patientSignatureDataUrl?: string;
  patientDeclineReason?: string;
  patientDeclineNotes?: string;
  witnessStaffName?: string;
  witnessSignatureDataUrl?: string;
  interpreterUsed?: boolean;
  interpreterMethod?: string;
  interpreterName?: string;
  interpreterAbsentJustification?: string;
}

/** An interpreter is required whenever the form is not being conducted in English. */
export function needsInterpreter(languageCode: string | undefined): boolean {
  return !!languageCode && languageCode.toLowerCase() !== "en";
}

/**
 * Witness requirement, ported EXACTLY: a witness is required when the patient
 * DECLINED to sign AND no capacity flag is present. Where a capacity flag is
 * present the reference explicitly treats the signature as "for completeness
 * only", so a witness to the decline adds nothing — the prescriber
 * notification, not the signature, is the safeguard.
 */
export function witnessRequiredFor(mode: PatientMode | undefined, capacityFlags: string[]): boolean {
  return mode === "declined" && capacityFlags.length === 0;
}

export const CAPACITY_BANNER_TEXT =
  "This patient has an active capacity-related flag. Any signature collected here is for completeness only — it does not constitute informed refusal and does not override the underlying order. Notify the prescriber per protocol.";

export const GUARDIAN_NOTE_TEXT =
  "This patient is under 18. A parent or legal guardian should be notified of this refusal per protocol. Structured guardian signature capture is not yet available in this release — document guardian contact in the nurse note below.";

export const NURSE_ATTESTATION_TEXT =
  "I attest that I explained the risks and benefits above to the patient in a manner they could understand, that the patient refused the medication, and that this record is accurate.";

/** Everything blocking finalization, in display order. Empty array = can finalize. */
export function refusalFinalizeProblems(
  form: Pick<RefusalForm, "languageCode" | "capacityFlagsAtSigning">,
  payload: RefusalFinalizePayload,
): string[] {
  const problems: string[] = [];
  if (!payload.nurseAttested) problems.push("Nurse attestation is required.");
  if (!payload.patientMode)
    problems.push("Record whether the patient signed or declined to sign.");
  if (payload.patientMode === "declined" && !payload.patientDeclineReason?.trim())
    problems.push("Select why the patient did not sign.");
  if (payload.patientMode === "signed" && !payload.patientSignatureDataUrl)
    problems.push("Capture the patient's signature.");
  if (needsInterpreter(form.languageCode)) {
    if (!payload.interpreterMethod) problems.push("Select how interpretation was provided.");
    else if (
      payload.interpreterMethod === "not_available" &&
      !payload.interpreterAbsentJustification?.trim()
    )
      problems.push("Justify proceeding without an interpreter.");
  }
  if (
    witnessRequiredFor(payload.patientMode, form.capacityFlagsAtSigning ?? []) &&
    !payload.witnessStaffName?.trim()
  )
    problems.push("A witness is required when the patient declines to sign.");
  if (!payload.nurseSignatureDataUrl) problems.push("The nurse signature is required.");
  return problems;
}

export function canFinalizeRefusal(
  form: Pick<RefusalForm, "languageCode" | "capacityFlagsAtSigning">,
  payload: RefusalFinalizePayload,
): boolean {
  return refusalFinalizeProblems(form, payload).length === 0;
}

/** Header summary for the form: what was refused. */
export function refusalMedSummary(order: MedOrder | undefined): string {
  if (!order) return "Medication";
  return [order.productName ?? order.drugName, order.dose, order.route].filter(Boolean).join(" · ");
}

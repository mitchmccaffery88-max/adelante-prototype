/**
 * Front-door routing (Phase 1).
 *
 * Pure logic for the pre-intake entry sequence, the corrected payer /
 * justice-involvement model, and the "how did you hear about us" gate.
 * Kept free of React so it can be unit-tested directly.
 */

/** A real three-way answer — every front-door question offers "not sure". */
export type TriState = "yes" | "no" | "unsure";

/**
 * Payer bucket. Deliberately independent of `CoverageStatus` (which describes
 * the *state* of a Medi-Cal record: active / suspended / unknown) — a person
 * can be Medicare-primary and still have a suspended Medi-Cal record.
 */
export type CoverageType =
  | "medi_cal"
  | "medicare"
  | "dual"
  | "private"
  | "self_pay"
  | "unknown";

export const COVERAGE_TYPES: { key: CoverageType; label: string }[] = [
  { key: "medi_cal", label: "Medi-Cal" },
  { key: "medicare", label: "Medicare" },
  { key: "dual", label: "Both Medi-Cal and Medicare (dual-eligible)" },
  { key: "private", label: "Private or commercial insurance" },
  { key: "self_pay", label: "No insurance / paying myself" },
  { key: "unknown", label: "I don't know" },
];

/** CalAIM ECM is a Medi-Cal construct — the follow-up only applies to these. */
export function ecmQuestionApplies(t: CoverageType): boolean {
  return t === "medi_cal" || t === "dual";
}

export type HeardAboutSource =
  | "probation_parole_drug_court"
  | "correctional_health"
  | "community_org"
  | "peer_specialist"
  | "card_flyer"
  | "word_of_mouth"
  | "found_it";

export const HEARD_ABOUT_SOURCES: { key: HeardAboutSource; label: string }[] = [
  { key: "probation_parole_drug_court", label: "Probation, parole, or drug court" },
  { key: "correctional_health", label: "Correctional health staff" },
  { key: "community_org", label: "A community organization" },
  { key: "peer_specialist", label: "A peer specialist" },
  { key: "card_flyer", label: "A card or flyer" },
  { key: "word_of_mouth", label: "Word of mouth" },
  { key: "found_it", label: "I just found it" },
];

/**
 * Coverage messaging. THE BUG THIS FIXES: the old `CoverageCallout` "other"
 * branch promised *everyone* with non-Medi-Cal coverage that "your sessions
 * stay free through our reentry program". That is only true for people the
 * reentry program actually covers — i.e. justice-involved patients. A
 * private-pay patient who was never justice-involved must get real billing /
 * sliding-scale information instead.
 *
 * So the safety-net promise now keys off `justiceInvolvement`, never off the
 * coverage type. "unsure" is treated as *possibly* eligible: we say we will
 * check rather than either promising or denying.
 */
export interface CoverageMessage {
  tone: "good" | "info" | "action";
  title: string;
  body: string;
  /** The reentry safety-net promise, layered on only when it is truthful. */
  reentrySafetyNet?: string;
  /** Real cost information — shown when no safety net covers the person. */
  billingNote?: string;
}

export function coverageMessage(input: {
  coverageType: CoverageType;
  justiceInvolvement: TriState;
  county?: string;
}): CoverageMessage {
  const { coverageType, justiceInvolvement, county } = input;
  const where = county ? `${county} County` : "your county";

  const base: CoverageMessage = (() => {
    switch (coverageType) {
      case "medi_cal":
        return {
          tone: "good",
          title: "Your visits are covered.",
          body: `Medi-Cal covers Adelante visits in full. We'll verify your ID with ${where} — nothing for you to do.`,
        };
      case "dual":
        return {
          tone: "good",
          title: "Your visits are covered.",
          body: `With both Medicare and Medi-Cal, Medicare bills first and Medi-Cal covers what's left. You should not receive a bill. We'll verify with ${where}.`,
        };
      case "medicare":
        return {
          tone: "info",
          title: "We'll bill Medicare.",
          body: "Medicare covers most behavioral health visits. Depending on your plan there may be a copay or deductible.",
          billingNote:
            "If a copay applies, we'll tell you the amount before your visit and can set up a payment plan or sliding-scale discount.",
        };
      case "private":
        return {
          tone: "info",
          title: "We'll bill your plan.",
          body: "We'll check your benefits before your first visit and tell you what your plan covers.",
          billingNote:
            "Anything your plan doesn't cover — copay, deductible, or a denied visit — is billed to you. We offer an income-based sliding scale and payment plans, and we'll go over the cost with you before you're charged.",
        };
      case "self_pay":
        return {
          tone: "action",
          title: "Let's look at your options.",
          body: "You may qualify for Medi-Cal — a case manager can start a BenefitsCal application with you, and most applications are approved within about 10 days.",
          billingNote:
            "Until coverage starts, visits are billed on our income-based sliding scale. We'll agree on the amount with you up front — you will never get a surprise bill.",
        };
      case "unknown":
      default:
        return {
          tone: "action",
          title: "We'll figure out your coverage with you.",
          body: `A case manager will check for active coverage with ${where} and walk you through the options. Not knowing does not delay your first visit.`,
          billingNote:
            "We won't bill you for anything until we've confirmed your coverage and gone over the cost with you.",
        };
    }
  })();

  if (justiceInvolvement === "yes") {
    return {
      ...base,
      // The safety net genuinely applies — and it supersedes cost worry.
      billingNote: undefined,
      reentrySafetyNet:
        "Because you're part of our reentry program, anything your coverage doesn't pay for is covered by the program. You will not get a bill.",
    };
  }
  if (justiceInvolvement === "unsure") {
    return {
      ...base,
      reentrySafetyNet:
        "You may also qualify for our reentry program, which covers whatever your insurance doesn't. A case manager will check — we won't bill you while that's pending.",
    };
  }
  // justiceInvolvement === "no": no reentry language at all. This is the fix.
  return base;
}

/**
 * "How did you hear about us" is only asked of the general-population path:
 * someone who arrived on their own, with no existing plan and no formal
 * referral. Everyone else already has a known source in the data model.
 */
export function shouldAskHeardAbout(input: {
  /** Q3 — seeking care for themselves. */
  seekingCareForSelf: boolean;
  /** Q1 — already has a care plan / case manager. */
  existingCare: TriState;
  /** Patient row was materialized from a `Referral` (formal referral submission). */
  hasReferralRecord: boolean;
  /** Patient has a `PreReleaseEpisode` (Track A, pre-release). */
  hasPreReleaseEpisode: boolean;
}): boolean {
  if (!input.seekingCareForSelf) return false;
  if (input.existingCare === "yes") return false;
  if (input.hasReferralRecord) return false;
  if (input.hasPreReleaseEpisode) return false;
  return true;
}

/**
 * Front-door contact validation. The person picks either — we accept a valid
 * email OR a real 10/11-digit US phone, and say which one we read it as so
 * the staff queue can show it correctly.
 */
export type ContactKind = "email" | "phone";
export interface ContactValidation {
  valid: boolean;
  kind?: ContactKind;
  /** Plain-language reason, shown inline. */
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function validateContact(raw: string | undefined | null): ContactValidation {
  const value = (raw ?? "").trim();
  if (!value) return { valid: false, error: "Add an email or phone number so we can reach you." };
  if (value.includes("@")) {
    return EMAIL_RE.test(value)
      ? { valid: true, kind: "email" }
      : { valid: false, error: "That email address doesn't look right." };
  }
  const digits = value.replace(/\D/g, "");
  if (/^1?\d{10}$/.test(digits)) return { valid: true, kind: "phone" };
  return {
    valid: false,
    error: "Enter a 10-digit phone number or an email address.",
  };
}

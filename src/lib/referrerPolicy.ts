// Privacy P3 — what a REFERRER may be told about a referral (Mitch, Oct 20).
// Pure rules, no store import. Draft — pending clinical sign-off.
//
//   • Covered provider: "outreach completed" and "enrolled on <date>" only.
//   • Community org, family/acquaintance, self, or unknown (no type recorded):
//     generic receipt only, unless the person said "yes" to telling that named
//     referrer (not revoked) — and then only "enrolled on <date>".
//   • SUD / Part 2: generic receipt only, for everyone, unless a Part 2 consent
//     naming that recipient is on file.
//   • Declines are never shared. No patient name in any text.

// The referral record lives in ehr.ts (locked by earlier parity checks); the
// new optional field is added by declaration merging. Absent = "unknown".
declare module "./ehr" {
  interface Referral {
    referrerType?: ReferrerType;
  }
}

export const REFERRER_POLICY_DRAFT = "Draft — pending clinical sign-off";

export const REFERRER_TYPES = ["covered_provider", "community_org", "family", "self"] as const;
export type ReferrerType = (typeof REFERRER_TYPES)[number];

export const REFERRER_TYPE_LABELS: Record<ReferrerType | "unknown", string> = {
  covered_provider: "Healthcare provider / covered entity",
  community_org: "Community or non-clinical organization",
  family: "Family member or acquaintance",
  self: "Self",
  unknown: "Unknown (not recorded)",
};

/** Spanish draft — pending translation review. */
export const REFERRER_TYPE_LABELS_ES: Record<ReferrerType, string> = {
  covered_provider: "Proveedor de salud / entidad cubierta",
  community_org: "Organización comunitaria o no clínica",
  family: "Familiar o conocido",
  self: "Yo mismo/a",
};

export type ReferrerEvent = "received" | "contacted" | "enrolled" | "declined";

export interface ReferrerAuthorization {
  answer: "yes" | "no";
  /** The referrer name/organization the question named, as asked. */
  referrerNamed: string;
  recordedAt: string;
  recordedBy: { name: string; role: string; staffId?: string };
  revokedAt?: string;
  revokedBy?: { name: string; role: string; staffId?: string };
}

export function referrerTypeOf(t: string | undefined): ReferrerType | "unknown" {
  return (REFERRER_TYPES as readonly string[]).includes(t ?? "") ? (t as ReferrerType) : "unknown";
}

/** Name/organization the authorization question names. */
export function referrerDisplayName(r: { referrerName?: string; referringAgency?: string }): string {
  const name = r.referrerName?.trim() ?? "";
  const org = r.referringAgency?.trim() ?? "";
  return name && org ? `${name} (${org})` : name || org || "the person who referred you";
}

export function authorizationQuestion(r: { referrerName?: string; referringAgency?: string }): string {
  return `Is it OK if we let ${referrerDisplayName(r)} know you've enrolled with us?`;
}

export function authorizationActive(a: ReferrerAuthorization | undefined, namedNow: string): boolean {
  return !!a && a.answer === "yes" && !a.revokedAt && a.referrerNamed === namedNow;
}

export const HELD = {
  noAuthorization: "Held: no authorization on file",
  part2: "Held: Part 2 — no consent naming this recipient on file",
  enrollmentOnly: "Held: the authorization covers enrollment only",
  decline: "Held: decline reasons and outcomes are never shared with referrers",
} as const;

export type ReferrerDecision =
  | { send: true; message: "receipt" | "outreach_completed" | "enrolled"; recordClassSud: boolean }
  | { send: false; held: string };

export interface ReferrerContext {
  type: ReferrerType | "unknown";
  /** Patient in a Part 2 program, or the referral is SUD-related. */
  sud: boolean;
  /** A Part 2 consent naming this referrer is on file. */
  part2ConsentNamed: boolean;
  /** A non-revoked "yes" naming this referrer is on file. */
  authorized: boolean;
}

export function decideReferrerUpdate(event: ReferrerEvent, ctx: ReferrerContext): ReferrerDecision {
  if (event === "received") return { send: true, message: "receipt", recordClassSud: false };
  if (event === "declined") return { send: false, held: HELD.decline };
  if (ctx.sud && !ctx.part2ConsentNamed) return { send: false, held: HELD.part2 };
  if (ctx.type !== "covered_provider") {
    // The question asked is about enrollment only — nothing about contact.
    if (!ctx.authorized) return { send: false, held: HELD.noAuthorization };
    if (event === "contacted") return { send: false, held: HELD.enrollmentOnly };
  }
  return { send: true, message: event === "contacted" ? "outreach_completed" : "enrolled", recordClassSud: ctx.sud };
}

export const REFERRER_RECEIPT_TEXT =
  "Thank you for your referral. We received it and will follow up per our standard outreach process.";

/** Never contains a patient name. `enrolledOn` is YYYY-MM-DD. */
export function composeReferrerMessage(message: "receipt" | "outreach_completed" | "enrolled", enrolledOn?: string): string {
  const tail = " Reply STOP to stop these texts.";
  const body =
    message === "receipt"
      ? `Adelante: ${REFERRER_RECEIPT_TEXT}`
      : message === "outreach_completed"
        ? "Adelante: outreach for your referral is completed."
        : `Adelante: the person you referred enrolled on ${enrolledOn ?? "a recent date"}.`;
  return (body + tail).slice(0, 320);
}

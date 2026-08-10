/**
 * §Self-service sign-up (front door, step 0).
 *
 * Pure validation + shared copy for the account-creation step that now sits
 * BEFORE the Phase 1 `/start` routing questions. Kept React-free so it can be
 * unit-tested directly.
 *
 * ============================ HONESTY NOTE ============================
 * PROTOTYPE-ONLY CREDENTIALS. This is NOT authentication.
 *
 * There is no backend, no identity provider, and nothing that verifies a
 * password or PIN on any subsequent visit. The credential step exists so the
 * flow *looks and behaves* like a real sign-up (real field validation, a real
 * `Patient` record created through the normal `createPatient` path), but:
 *
 *   - the entered password / PIN is NEVER stored, hashed, or transmitted;
 *   - only the FACT that one was chosen is recorded (`credentialKind`,
 *     `credentialSetAt`) so staff can see the person went through this step;
 *   - anyone can still open any demo record from `/auth`, unchanged.
 *
 * This is the same known production gap already flagged for advocate
 * authentication (see `src/lib/advocate.ts`): identity proofing and session
 * security must be built on a real backend before any live use.
 * ======================================================================
 */

import { z } from "zod";

export const CREDENTIAL_PROTOTYPE_NOTICE =
  "This sets up how you'll get back in later. In this preview your password or PIN isn't stored or checked — real sign-in security comes with the live system.";

export type CredentialKind = "password" | "pin";

/** What we are willing to persist about the credential step. Never the secret. */
export interface SignupCredentialMeta {
  kind: CredentialKind;
  /** Prototype marker — always true here; there is nothing to verify against. */
  verificationAvailable: false;
  setAt: string;
}

const phoneRe = /^[0-9()+\-.\s]{7,20}$/;

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, { message: "First name is required" }).max(80),
    lastName: z.string().trim().min(1, { message: "Last name is required" }).max(80),
    dob: z
      .string()
      .trim()
      .min(1, { message: "Date of birth is required" })
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Enter a valid date" })
      .refine((v) => new Date(v) <= new Date(), { message: "Date of birth can't be in the future" }),
    phone: z
      .string()
      .trim()
      .max(20)
      .refine((v) => v === "" || phoneRe.test(v), { message: "Enter a valid phone number" }),
    email: z
      .string()
      .trim()
      .max(255)
      .refine((v) => v === "" || z.string().email().safeParse(v).success, {
        message: "Enter a valid email address",
      }),
    preferredLanguage: z.enum(["en", "es"]),
    credentialKind: z.enum(["password", "pin"]),
    credential: z.string(),
    credentialConfirm: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Give us a phone number or an email so we can reach you",
      });
    }
    if (v.credentialKind === "pin") {
      if (!/^\d{4,8}$/.test(v.credential)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["credential"],
          message: "PIN must be 4–8 digits",
        });
      }
    } else if (v.credential.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credential"],
        message: "Password must be at least 8 characters",
      });
    }
    if (v.credential !== v.credentialConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credentialConfirm"],
        message: "These don't match",
      });
    }
  });

export type SignupInput = z.input<typeof signupSchema>;

export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

/** Validate a draft, returning field-keyed messages for inline display. */
export function validateSignup(draft: SignupInput): SignupErrors {
  const res = signupSchema.safeParse(draft);
  if (res.success) return {};
  const errs: SignupErrors = {};
  for (const issue of res.error.issues) {
    const key = issue.path[0] as keyof SignupInput | undefined;
    if (key && !errs[key]) errs[key] = issue.message;
  }
  return errs;
}

/**
 * Build the credential metadata we persist. Deliberately drops the secret —
 * see the honesty note above. Do not "improve" this by storing a hash: a
 * client-side hash with no server to check it against would imply security
 * that does not exist.
 */
export function credentialMeta(kind: CredentialKind, now = new Date()): SignupCredentialMeta {
  return { kind, verificationAvailable: false, setAt: now.toISOString() };
}

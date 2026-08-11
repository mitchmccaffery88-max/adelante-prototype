// §Adelante Journey Phase 6 — Community Resource Center.
//
// WHERE THIS LIVES, AND WHY (the Phase 5 engagement precedent, applied):
// this is SDOH / community reference data. It is not authored by a clinician,
// nothing bills off it, and it is not about one patient — so it must not
// become fields on `Patient` or rows in the clinical record. The EHR already
// has `ResourceReferral` on the patient (a per-patient CLINICAL act: "we
// referred this person to X"). That is the natural join partner, not the
// natural home: a directory entry exists whether or not anybody was ever
// referred to it. So, exactly like `engagement.ts`, this is its own adjacent
// module with its own store; `ResourceReferral.resource` keys back to a
// directory entry by name/id when a referral is actually made.
//
// VERIFICATION IS REAL, NOT COSMETIC. A seeded entry is `unverified` and is
// invisible to patients. It only becomes live when a named staff member
// records a verification with the three facts they actually confirmed
// (address, phone, hours). Verifications expire, which sends the entry back
// out of the patient-facing list rather than quietly ageing into fiction.
import { getStaffMember, type StaffRole } from "@/lib/roles";

export interface ResourceCategory {
  id: string;
  name: string;
  order: number;
}

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  { id: "housing", name: "Housing", order: 1 },
  { id: "emergency_shelter", name: "Emergency Shelter", order: 2 },
  { id: "food", name: "Food Assistance", order: 3 },
  { id: "employment", name: "Employment", order: 4 },
  { id: "transportation", name: "Transportation", order: 5 },
  { id: "recovery_meetings", name: "Recovery Meetings", order: 6 },
  { id: "support_groups", name: "Support Groups", order: 7 },
  { id: "family_reunification", name: "Family & Reunification", order: 8 },
  { id: "healthcare", name: "Healthcare", order: 9 },
  { id: "education", name: "Education", order: 10 },
  { id: "parenting", name: "Parenting", order: 11 },
  { id: "financial", name: "Financial Assistance", order: 12 },
  { id: "legal", name: "Legal Services", order: 13 },
  { id: "life_skills", name: "Life Skills", order: 14 },
];

export type VerificationStatus = "unverified" | "verified" | "needs_update";

export interface ResourceVerification {
  verifiedBy: string;
  verifiedByStaffId?: string;
  verifiedAt: string;
  /** All three must be confirmed — a partial check does not make it live. */
  confirmedAddress: boolean;
  confirmedPhone: boolean;
  confirmedHours: boolean;
  note?: string;
  /** Verification is not permanent; re-check by this date. */
  expiresOn: string;
}

export interface CommunityResource {
  id: string;
  categoryId: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  description: string;
  /** Seed data is structure, not sourced fact. */
  placeholder?: boolean;
  verified: boolean;
  status: VerificationStatus;
  verification?: ResourceVerification;
}

/** Roles allowed to make a directory entry live. */
export const RESOURCE_VERIFIER_ROLES: StaffRole[] = [
  "cf_care_manager",
  "ecm_provider",
  "clinical_coordinator",
  "community_health_worker",
  "peer_specialist",
  "sys_admin",
];

/** How long a verification stands before it must be re-checked. */
export const VERIFICATION_VALID_DAYS = 180;

function seed(
  id: string,
  categoryId: string,
  name: string,
  description: string,
): CommunityResource {
  return {
    id,
    categoryId,
    name,
    // Deliberately empty rather than fabricated: staff SOURCE these, we do not
    // invent Tulare/Kings County addresses and phone numbers.
    address: "",
    phone: "",
    hours: "",
    description,
    placeholder: true,
    verified: false,
    status: "unverified",
  };
}

/**
 * A small, explicitly-placeholder seed: one skeleton entry per category, so
 * the structure is exercised end to end and nothing reads as a real listing.
 */
export const SEED_RESOURCES: CommunityResource[] = RESOURCE_CATEGORIES.map((c) =>
  seed(`res_${c.id}_1`, c.id, `${c.name} — placeholder entry`, `Needs human sourcing: a real ${c.name.toLowerCase()} provider serving Tulare/Kings County.`),
);

const resources = new Map<string, CommunityResource>(
  SEED_RESOURCES.map((r) => [r.id, structuredClone(r)]),
);

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export function subscribeResources(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * PURE. The single definition of "live". Expired verifications are not live,
 * and an entry missing address/phone/hours can never be live regardless of
 * what someone ticked.
 */
export function isResourceLive(r: CommunityResource, asOf: string = today()): boolean {
  if (r.status !== "verified" || !r.verified || !r.verification) return false;
  const v = r.verification;
  if (!v.confirmedAddress || !v.confirmedPhone || !v.confirmedHours) return false;
  if (!r.address.trim() || !r.phone.trim() || !r.hours.trim()) return false;
  return v.expiresOn >= asOf;
}

export function listResources(categoryId?: string): CommunityResource[] {
  return [...resources.values()]
    .filter((r) => !categoryId || r.categoryId === categoryId)
    .map((r) => structuredClone(r))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** What a PATIENT may see: live entries only. */
export function patientVisibleResources(categoryId?: string): CommunityResource[] {
  return listResources(categoryId).filter((r) => isResourceLive(r));
}

/** The staff verification queue — everything not currently live. */
export function resourceVerificationQueue(): CommunityResource[] {
  return listResources().filter((r) => !isResourceLive(r));
}

export function getResource(id: string): CommunityResource | undefined {
  const r = resources.get(id);
  return r ? structuredClone(r) : undefined;
}

/** Staff sourcing pass: fill in the facts. Does NOT make anything live. */
export function updateResourceDetails(
  id: string,
  patch: Partial<Pick<CommunityResource, "name" | "address" | "phone" | "hours" | "description">>,
): CommunityResource | undefined {
  const r = resources.get(id);
  if (!r) return undefined;
  Object.assign(r, patch);
  // Editing the facts invalidates a prior confirmation of those facts.
  if (r.status === "verified") {
    r.status = "needs_update";
    r.verified = false;
  }
  notify();
  return structuredClone(r);
}

export interface VerifyInput {
  resourceId: string;
  actorStaffId?: string;
  actorName: string;
  actorRole: StaffRole;
  confirmedAddress: boolean;
  confirmedPhone: boolean;
  confirmedHours: boolean;
  note?: string;
}

export type VerifyResult =
  | { ok: true; resource: CommunityResource }
  | { ok: false; reason: string };

/**
 * The real staff verification action. Everything that could make this a badge
 * rather than a workflow is refused here: the wrong role, a missing fact, or
 * an incomplete confirmation.
 */
export function verifyResource(input: VerifyInput): VerifyResult {
  const r = resources.get(input.resourceId);
  if (!r) return { ok: false, reason: "No such resource." };
  if (!RESOURCE_VERIFIER_ROLES.includes(input.actorRole))
    return { ok: false, reason: "This role cannot publish a community resource." };
  if (input.actorStaffId && !getStaffMember(input.actorStaffId))
    return { ok: false, reason: "Unknown staff member." };
  if (!r.address.trim() || !r.phone.trim() || !r.hours.trim())
    return { ok: false, reason: "Address, phone and hours must be filled in before verification." };
  if (!input.confirmedAddress || !input.confirmedPhone || !input.confirmedHours)
    return { ok: false, reason: "All three facts must be confirmed with the provider." };

  const expires = new Date();
  expires.setDate(expires.getDate() + VERIFICATION_VALID_DAYS);
  r.verification = {
    verifiedBy: input.actorName,
    verifiedByStaffId: input.actorStaffId,
    verifiedAt: new Date().toISOString(),
    confirmedAddress: true,
    confirmedPhone: true,
    confirmedHours: true,
    note: input.note,
    expiresOn: expires.toISOString().slice(0, 10),
  };
  r.status = "verified";
  r.verified = true;
  r.placeholder = false;
  notify();
  return { ok: true, resource: structuredClone(r) };
}

/** Send a live entry back to the queue (hours changed, phone dead, closed). */
export function flagResourceForRecheck(id: string, reason: string): CommunityResource | undefined {
  const r = resources.get(id);
  if (!r) return undefined;
  r.status = "needs_update";
  r.verified = false;
  if (r.verification) r.verification.note = reason;
  notify();
  return structuredClone(r);
}

export function __resetResources(): void {
  resources.clear();
  for (const r of SEED_RESOURCES) resources.set(r.id, structuredClone(r));
}
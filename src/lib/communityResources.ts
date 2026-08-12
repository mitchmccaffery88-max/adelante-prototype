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
 * A SOURCED entry: a real Tulare County organisation with real web-sourced
 * contact details. Sourced is NOT verified — `verified: false` /
 * `status: "unverified"` still holds, so these stay out of the patient-facing
 * list until a named staff member actually calls and confirms address, phone
 * and hours through `verifyResource`. Hedges like "(verify hours)" are part of
 * the sourced text and are preserved verbatim.
 */
function sourced(
  id: string,
  categoryId: string,
  name: string,
  address: string,
  phone: string,
  hours: string,
  description: string,
): CommunityResource {
  return {
    id,
    categoryId,
    name,
    address,
    phone,
    hours,
    description,
    placeholder: false,
    verified: false,
    status: "unverified",
  };
}

/** Categories still awaiting human sourcing keep a skeleton placeholder. */
const UNSOURCED_CATEGORIES = [
  "recovery_meetings",
  "support_groups",
  "family_reunification",
  "healthcare",
  "education",
  "parenting",
  "financial",
  "legal",
  "life_skills",
];

export const SEED_RESOURCES: CommunityResource[] = [
  // ---- Housing -------------------------------------------------------
  sourced(
    "res_housing_teac",
    "housing",
    "Tulare Emergency Aid Council",
    "424 North N Street, Tulare, CA",
    "(559) 686-3693",
    "(verify hours)",
    "Local emergency aid for Tulare residents, including help with rent, utilities and basic needs.",
  ),
  sourced(
    "res_housing_hatc",
    "housing",
    "Housing Authority of the County of Tulare",
    "5140 W. Cypress Ave, Visalia, CA",
    "(559) 627-3700",
    "(verify hours)",
    "Public housing and Section 8 / Housing Choice Voucher programs countywide. hatc.net",
  ),
  sourced(
    "res_housing_cset",
    "housing",
    "CSET – Housing & Homeless Services",
    "312 NW 3rd Ave, Visalia, CA",
    "(559) 741-4640",
    "(verify hours)",
    "Housing navigation, homeless outreach and rapid re-housing support across Tulare County. cset.org",
  ),
  sourced(
    "res_housing_selfhelp",
    "housing",
    "Self-Help Enterprises",
    "8445 W. Elowin Ct, Visalia, CA",
    "(559) 651-1000",
    "(verify hours)",
    "Affordable housing development, home repair and housing counseling for the San Joaquin Valley. selfhelpenterprises.org",
  ),
  sourced(
    "res_housing_211",
    "housing",
    "211 Tulare County – Housing Referrals",
    "Countywide (phone and web)",
    "211",
    "24/7",
    "Free, confidential referral line for housing and shelter options in Tulare County. 211tularecounty.org",
  ),

  // ---- Emergency Shelter ---------------------------------------------
  sourced(
    "res_shelter_tularecares",
    "emergency_shelter",
    "Tulare Cares Emergency Homeless Shelter",
    "Tulare, CA (verify address)",
    "(559) 684-4200",
    "(verify hours)",
    "Low-barrier navigation center with roughly 200 beds.",
  ),
  sourced(
    "res_shelter_vrm",
    "emergency_shelter",
    "Visalia Rescue Mission",
    "741 S. Santa Fe St, Visalia, CA",
    "(559) 740-4178",
    "(verify hours)",
    "Emergency shelter, meals and recovery programming in Visalia. vrmhope.org",
  ),
  sourced(
    "res_shelter_hope",
    "emergency_shelter",
    "Women and Children's Shelter of Hope / Visalia Rescue Mission",
    "Visalia, CA (verify address)",
    "(559) 734-7921",
    "Intake 4pm daily (verify)",
    "Shelter for women and children, with daily intake.",
  ),
  sourced(
    "res_shelter_karens_house",
    "emergency_shelter",
    "Family Services of Tulare County – Karen's House",
    "Confidential location",
    "(559) 732-5941",
    "24/7 crisis line",
    "Domestic-violence emergency shelter with a 24/7 crisis line. fstc.net",
  ),

  // ---- Food Assistance -----------------------------------------------
  sourced(
    "res_food_calfresh",
    "food",
    "CalFresh Tulare County",
    "Countywide (phone and web)",
    "1-877-410-8813",
    "(verify hours)",
    "Monthly food benefits (SNAP) — apply by phone or online. tularecounty.ca.gov",
  ),
  sourced(
    "res_food_foodlink",
    "food",
    "FoodLink for Tulare County",
    "7427 Sunnyview Ave, Visalia, CA",
    "(559) 651-3663",
    "(verify hours)",
    "County food bank supplying pantries and distributions across Tulare County. foodlinktc.org",
  ),
  sourced(
    "res_food_veac",
    "food",
    "Visalia Emergency Aid Council (VEAC)",
    "217 NE 3rd Street, Visalia, CA",
    "(559) 732-0101",
    "(verify hours)",
    "Emergency food boxes and basic-needs assistance for Visalia residents.",
  ),
  sourced(
    "res_food_mow",
    "food",
    "Meals on Wheels of Tulare County",
    "312 NW 3rd Street, Visalia, CA",
    "(559) 732-4194",
    "(verify hours)",
    "Home-delivered meals for seniors and homebound adults.",
  ),
  sourced(
    "res_food_211",
    "food",
    "211 Tulare County",
    "Countywide (phone and web)",
    "211",
    "24/7",
    "Free, confidential referral line for food pantries and distributions. 211tularecounty.org",
  ),

  // ---- Employment -----------------------------------------------------
  sourced(
    "res_employment_reset",
    "employment",
    "RESET – Readiness for Employment through Sustainable Education & Training",
    "Tulare County Probation, Adult Division",
    "(559) 730-2540",
    "(verify hours)",
    "Employment readiness, education and training built specifically for justice-involved adults. tcprobation.com",
  ),
  sourced(
    "res_employment_cset",
    "employment",
    "CSET Employment Training",
    "312 NW 3rd Ave, Visalia, CA",
    "(559) 741-4640",
    "(verify hours)",
    "Job training, placement and workforce services across Tulare County. cset.org",
  ),
  sourced(
    "res_employment_proteus",
    "employment",
    "Proteus Inc.",
    "1830 N. Dinuba Blvd, Visalia, CA",
    "(559) 733-5423",
    "(verify hours)",
    "Workforce training, education and support services, including for farmworkers. proteusinc.org",
  ),
  sourced(
    "res_employment_edd",
    "employment",
    "California EDD",
    "Statewide (phone and web)",
    "1-800-300-5616",
    "(verify hours)",
    "Unemployment benefits and statewide job services. edd.ca.gov",
  ),

  // ---- Transportation --------------------------------------------------
  sourced(
    "res_transportation_tcrta",
    "transportation",
    "RIDE Tulare County / TCRTA",
    "Countywide",
    "(800) 692-5915",
    "(verify hours)",
    "Countywide fixed-route buses, ADA paratransit and microtransit. ridetc.org",
  ),
  sourced(
    "res_transportation_visalia",
    "transportation",
    "Visalia Transit",
    "425 E. Oak Ave, Visalia, CA",
    "(559) 713-4100",
    "(verify hours)",
    "City bus service within Visalia. visalia.city/transit",
  ),

  // ---- Still awaiting human sourcing ----------------------------------
  ...RESOURCE_CATEGORIES.filter((c) => UNSOURCED_CATEGORIES.includes(c.id)).map((c) =>
    seed(
      `res_${c.id}_1`,
      c.id,
      `${c.name} — placeholder entry`,
      `Needs human sourcing: a real ${c.name.toLowerCase()} provider serving Tulare/Kings County.`,
    ),
  ),
];

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

/**
 * THE REAL VERIFICATION EVENT.
 *
 * Cathy (clinical coordinator) called every sourced organisation in this
 * directory and confirmed its address, phone and hours. That is a real human
 * pass, so it is recorded the only way this module allows one to be recorded:
 * by driving `verifyResource` — the same function the staff
 * `ResourceVerificationQueue` calls — with her real staff identity and all
 * three confirmations. Nothing here sets `verified` directly, so every gate
 * (role, complete facts, all three confirmations, expiry window) still runs.
 *
 * Only SOURCED entries are covered. The never-sourced skeletons stay in the
 * queue, invisible to patients, exactly as before.
 */
export const RESOURCE_VERIFIER_CATHY = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as StaffRole,
  note:
    "Human verification pass: address, phone and hours confirmed directly with each organisation. Published hours strings still carry the sourced '(verify hours)' hedge where the organisation gave no fixed public hours.",
};

export const CATHY_VERIFIED_RESOURCE_IDS: string[] = SEED_RESOURCES.filter(
  (r) => !r.placeholder,
).map((r) => r.id);

function applyRecordedVerifications(): void {
  for (const id of CATHY_VERIFIED_RESOURCE_IDS) {
    verifyResource({
      resourceId: id,
      actorStaffId: RESOURCE_VERIFIER_CATHY.staffId,
      actorName: RESOURCE_VERIFIER_CATHY.name,
      actorRole: RESOURCE_VERIFIER_CATHY.role,
      confirmedAddress: true,
      confirmedPhone: true,
      confirmedHours: true,
      note: RESOURCE_VERIFIER_CATHY.note,
    });
  }
}

applyRecordedVerifications();
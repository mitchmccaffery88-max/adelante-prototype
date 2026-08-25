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
// (address, phone, hours).
//
// §Content Management correction — THIS DIRECTORY IS NOW MANAGED CONTENT.
// Community Resources are editorial content for this program: the content
// manager adds locations and whole counties as it expands, and the same
// entries feed the website, patient portal, intake, onboarding and SDOH-needs
// alignment. So patient visibility no longer lives in this module's own
// `verified` flag — it lives in the shared content lifecycle store
// (`contentPublishing.ts`), exactly like a Library lesson: what a patient sees
// is the PUBLISHED snapshot, and it keeps being served until a new revision
// replaces it. This module remains the directory's typed shape, its seed data
// and its contact-verification workflow; `verifyResource` now publishes
// through the shared store, so a verification is a real publish with real
// revision history rather than a private boolean.
import { getStaffMember, type StaffRole } from "@/lib/roles";
// Ported Adelante Journey directory listings (generated).
import { PORTED_RESOURCES } from "@/lib/communityResources.ported";
import {
  publishedContentOfType,
  seedDraftContent,
  seedPublishedContent,
  subscribeContent,
  __resetContentOfType,
} from "@/lib/contentPublishing";

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
}

export interface CommunityResource {
  id: string;
  categoryId: string;
  name: string;
  address: string;
  phone: string;
  hours: string;
  description: string;
  /**
   * Real public website for the organisation. Previously these URLs were
   * stranded inside `description` text; Build B migrated every one of them
   * into this field (15 hand-sourced entries + 38 ported listings).
   */
  website?: string;
  /**
   * Geo is DELIBERATELY EMPTY. Nobody has geocoded this directory, so there
   * are no real coordinates to store and we will not fabricate any. The
   * fields exist so a real geocoding pass can populate them later; until then
   * "Directions" opens a maps SEARCH for the address string, which is honest
   * about the fact that we only know the address, not the point.
   */
  lat?: number;
  lng?: number;
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

// REMOVED: the 180-day verification expiry and the silent auto-unpublish that
// went with it (`VERIFICATION_VALID_DAYS`, `ResourceVerification.expiresOn`,
// `flagResourceForRecheck`). Product direction: at this stage of the program
// there is one county and one team, and content silently vanishing from the
// patient portal on a timer is worse than a stale phone number nobody was
// warned about.
//
// THIS IS ANTICIPATED TO COME BACK. Once there are multiple site / county /
// state partners, "who last confirmed this, and how long ago" stops being
// answerable from memory and a re-check clock becomes genuinely valuable. The
// shape to reintroduce is a re-check DUE DATE that surfaces the entry in the
// staff queue and badges it in the admin UI — it should still not unpublish
// anything on its own; a human decides to pull an entry.

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
  website?: string,
): CommunityResource {
  return {
    id,
    categoryId,
    name,
    address,
    phone,
    hours,
    description,
    website,
    placeholder: false,
    verified: false,
    status: "unverified",
  };
}

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
    "Public housing and Section 8 / Housing Choice Voucher programs countywide.",
    "https://hatc.net",
  ),
  sourced(
    "res_housing_cset",
    "housing",
    "CSET – Housing & Homeless Services",
    "312 NW 3rd Ave, Visalia, CA",
    "(559) 741-4640",
    "(verify hours)",
    "Housing navigation, homeless outreach and rapid re-housing support across Tulare County.",
    "https://cset.org",
  ),
  sourced(
    "res_housing_selfhelp",
    "housing",
    "Self-Help Enterprises",
    "8445 W. Elowin Ct, Visalia, CA",
    "(559) 651-1000",
    "(verify hours)",
    "Affordable housing development, home repair and housing counseling for the San Joaquin Valley.",
    "https://selfhelpenterprises.org",
  ),
  sourced(
    "res_housing_211",
    "housing",
    "211 Tulare County – Housing Referrals",
    "Countywide (phone and web)",
    "211",
    "24/7",
    "Free, confidential referral line for housing and shelter options in Tulare County.",
    "https://211tularecounty.org",
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
    "Emergency shelter, meals and recovery programming in Visalia.",
    "https://vrmhope.org",
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
    "Domestic-violence emergency shelter with a 24/7 crisis line.",
    "https://fstc.net",
  ),

  // ---- Food Assistance -----------------------------------------------
  sourced(
    "res_food_calfresh",
    "food",
    "CalFresh Tulare County",
    "Countywide (phone and web)",
    "1-877-410-8813",
    "(verify hours)",
    "Monthly food benefits (SNAP) — apply by phone or online.",
    "https://tularecounty.ca.gov",
  ),
  sourced(
    "res_food_foodlink",
    "food",
    "FoodLink for Tulare County",
    "7427 Sunnyview Ave, Visalia, CA",
    "(559) 651-3663",
    "(verify hours)",
    "County food bank supplying pantries and distributions across Tulare County.",
    "https://foodlinktc.org",
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
    "Free, confidential referral line for food pantries and distributions.",
    "https://211tularecounty.org",
  ),

  // ---- Employment -----------------------------------------------------
  sourced(
    "res_employment_reset",
    "employment",
    "RESET – Readiness for Employment through Sustainable Education & Training",
    "Tulare County Probation, Adult Division",
    "(559) 730-2540",
    "(verify hours)",
    "Employment readiness, education and training built specifically for justice-involved adults.",
    "https://tcprobation.com",
  ),
  sourced(
    "res_employment_cset",
    "employment",
    "CSET Employment Training",
    "312 NW 3rd Ave, Visalia, CA",
    "(559) 741-4640",
    "(verify hours)",
    "Job training, placement and workforce services across Tulare County.",
    "https://cset.org",
  ),
  sourced(
    "res_employment_proteus",
    "employment",
    "Proteus Inc.",
    "1830 N. Dinuba Blvd, Visalia, CA",
    "(559) 733-5423",
    "(verify hours)",
    "Workforce training, education and support services, including for farmworkers.",
    "https://proteusinc.org",
  ),
  sourced(
    "res_employment_edd",
    "employment",
    "California EDD",
    "Statewide (phone and web)",
    "1-800-300-5616",
    "(verify hours)",
    "Unemployment benefits and statewide job services.",
    "https://edd.ca.gov",
  ),

  // ---- Transportation --------------------------------------------------
  sourced(
    "res_transportation_tcrta",
    "transportation",
    "RIDE Tulare County / TCRTA",
    "Countywide",
    "(800) 692-5915",
    "(verify hours)",
    "Countywide fixed-route buses, ADA paratransit and microtransit.",
    "https://ridetc.org",
  ),
  sourced(
    "res_transportation_visalia",
    "transportation",
    "Visalia Transit",
    "425 E. Oak Ave, Visalia, CA",
    "(559) 713-4100",
    "(verify hours)",
    "City bus service within Visalia.",
    "https://visalia.city/transit",
  ),

  // ---- Ported Adelante Journey listings (sourced, still unverified) ----
  // Every remaining category is now covered by real organisations instead of
  // a skeleton placeholder. They stay invisible to patients until verified.
  ...PORTED_RESOURCES,
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

// A publish in the shared content store must also wake this module's
// subscribers: a resource published through /admin-content is patient-visible
// immediately, so the patient list has to re-render.
subscribeContent(() => notify());

/**
 * PURE. Whether this entry has a COMPLETE contact verification on it. No
 * expiry: a verification does not rot on a timer any more (see the removal
 * note above). This is the staff-queue predicate, not the patient one —
 * patient visibility is `patientVisibleResources`, i.e. what is PUBLISHED.
 */
export function isResourceVerified(r: CommunityResource): boolean {
  if (r.status !== "verified" || !r.verified || !r.verification) return false;
  const v = r.verification;
  if (!v.confirmedAddress || !v.confirmedPhone || !v.confirmedHours) return false;
  return !!(r.address.trim() && r.phone.trim() && r.hours.trim());
}

export function listResources(categoryId?: string): CommunityResource[] {
  return [...resources.values()]
    .filter((r) => !categoryId || r.categoryId === categoryId)
    .map((r) => structuredClone(r))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What a PATIENT may see: the PUBLISHED snapshot of every managed resource,
 * read straight out of the shared content store. Nothing here consults the
 * local `verified` flag — publishing is the one visibility switch, whether the
 * publish came from `verifyResource` or from the content manager in
 * /admin-content.
 */
export function patientVisibleResources(categoryId?: string): CommunityResource[] {
  return publishedContentOfType("community_resource")
    .map((b) => b as unknown as CommunityResource)
    .filter((r) => !!r.id && (!categoryId || r.categoryId === categoryId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The staff verification queue — everything without a complete verification. */
export function resourceVerificationQueue(): CommunityResource[] {
  return listResources().filter((r) => !isResourceVerified(r));
}

/**
 * PURE. Free-text match over the facts a patient would actually type: the
 * organisation's name and what it does. Case- and accent-insensitive enough
 * for a phone keyboard; deliberately not fuzzy, so results never look random.
 */
export function matchesResourceQuery(r: CommunityResource, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${r.name} ${r.description}`.toLowerCase();
  return q.split(/\s+/).every((t) => hay.includes(t));
}

/** One published listing, for the detail screen. Undefined if not live. */
export function patientVisibleResource(id: string): CommunityResource | undefined {
  return patientVisibleResources().find((r) => r.id === id);
}

/**
 * §Gap-closure Build 1 — what a patient BROWSES.
 *
 * Hiding unverified listings hid real help. The directory now shows every
 * listing we hold, with the published (staff-verified) snapshot winning for
 * anything that has one, and the rest surfaced honestly as pending
 * verification. The verification workflow itself is untouched:
 * `patientVisibleResources` is still the PUBLISHED set, and
 * `isResourceVerified` still decides the badge.
 */
export function patientBrowsableResources(categoryId?: string): CommunityResource[] {
  const byId = new Map<string, CommunityResource>(
    listResources(categoryId).map((r) => [r.id, r]),
  );
  for (const r of patientVisibleResources(categoryId)) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function patientBrowsableResource(id: string): CommunityResource | undefined {
  return patientBrowsableResources().find((r) => r.id === id);
}

/**
 * Honest maps link for a plain address string: a maps SEARCH, never a
 * fabricated coordinate. Returns null when there is nothing real to search
 * (blank, or a countywide/statewide/confidential placeholder).
 *
 * Shared with non-resource surfaces (e.g. in-person appointment locations) so
 * there is exactly one geo behaviour in the app.
 */
export function mapsSearchUrl(address: string | undefined | null): string | null {
  const addr = (address ?? "").trim();
  if (!addr || /^countywide|^statewide|^confidential/i.test(addr)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

/** Honest directions: a maps SEARCH for the address string, or the point if
 *  a real geocode ever lands on the record. Never a fabricated coordinate. */
export function directionsUrl(r: CommunityResource): string | null {
  if (typeof r.lat === "number" && typeof r.lng === "number")
    return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  return mapsSearchUrl(r.address);
}


export function getResource(id: string): CommunityResource | undefined {
  const r = resources.get(id);
  return r ? structuredClone(r) : undefined;
}

/**
 * Staff sourcing pass: fill in the facts. Does NOT publish, and — unlike
 * before — does NOT yank a published entry away from patients either. The
 * published snapshot keeps being served until a new one replaces it, the same
 * rule every managed lesson follows. Nothing disappears without a human act.
 */
export function updateResourceDetails(
  id: string,
  patch: Partial<
    Pick<CommunityResource, "name" | "address" | "phone" | "hours" | "description" | "website">
  >,
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
  /** Historical replay only: the real timestamp of a past verification. */
  atISO?: string;
}

export type VerifyResult =
  | { ok: true; resource: CommunityResource }
  | { ok: false; reason: string };

/**
 * The real staff verification action, and now also the PUBLISH act for a
 * directory entry: on success it writes the entry into the shared content
 * store as a published revision attributed to the verifier. The role gate that
 * protects publishing here is `RESOURCE_VERIFIER_ROLES` (checked immediately
 * below) — deliberately wider than the content-manager roster, because
 * confirming a shelter's phone number is a task anyone who made the call can
 * attest to.
 *
 * Everything that could make this a badge rather than a workflow is still
 * refused: the wrong role, a missing fact, an incomplete confirmation.
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

  const at = input.atISO ?? new Date().toISOString();
  r.verification = {
    verifiedBy: input.actorName,
    verifiedByStaffId: input.actorStaffId,
    verifiedAt: at,
    confirmedAddress: true,
    confirmedPhone: true,
    confirmedHours: true,
    note: input.note,
  };
  r.status = "verified";
  r.verified = true;
  r.placeholder = false;
  seedPublishedContent({
    typeId: "community_resource",
    id: r.id,
    body: structuredClone(r) as unknown as Record<string, unknown>,
    actor: { staffId: input.actorStaffId, name: input.actorName, role: input.actorRole },
    atISO: at,
    note: input.note,
  });
  notify();
  return { ok: true, resource: structuredClone(r) };
}

export function __resetResources(): void {
  resources.clear();
  __resetContentOfType("community_resource");
  for (const r of SEED_RESOURCES) resources.set(r.id, structuredClone(r));
  applyRecordedVerifications();
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
 * (role, complete facts, all three confirmations) still runs.
 *
 * HOW IT SURVIVED THE MIGRATION ONTO THE CONTENT MODEL. It was not re-stamped
 * with today's date and it was not replaced by a synthetic "migrated" event.
 * `verifyResource` now publishes into the shared content store, and the replay
 * passes Cathy's REAL verification timestamp through `atISO`, so each of the
 * 20 sourced entries lands in `/admin-content` history as revision 1:
 * published, by Cathy (clinical_coordinator, s-cc2), on 2026-08-12, carrying
 * her verbatim verification note. Her pass IS the initial published revision.
 *
 * Only SOURCED entries are covered. The never-sourced skeletons stay in the
 * queue as unpublished DRAFTS in the content store — editable by the content
 * manager, invisible to patients, exactly as before.
 */
export const RESOURCE_VERIFIER_CATHY = {
  staffId: "s-cc2",
  name: "Cathy",
  role: "clinical_coordinator" as StaffRole,
  /** The real date of her pass — the same one recorded on the naloxone track. */
  verifiedOn: "2026-08-12",
  note:
    "Human verification pass: address, phone and hours confirmed directly with each organisation. Published hours strings still carry the sourced '(verify hours)' hedge where the organisation gave no fixed public hours.",
};

/**
 * Cathy's real pass covers only the entries THIS program sourced and she
 * actually called. The ported Adelante Journey listings were never part of
 * that pass, so they must not inherit her attribution: they stay unverified
 * and land in the staff verification queue like any newly sourced entry.
 */
const PORTED_RESOURCE_IDS = new Set(PORTED_RESOURCES.map((r) => r.id));

export const CATHY_VERIFIED_RESOURCE_IDS: string[] = SEED_RESOURCES.filter(
  (r) => !r.placeholder && !PORTED_RESOURCE_IDS.has(r.id),
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
      atISO: `${RESOURCE_VERIFIER_CATHY.verifiedOn}T00:00:00.000Z`,
    });
  }
  // Everything Cathy did NOT verify still becomes managed content — as a
  // draft, so the content manager can source it in /admin-content instead of
  // waiting for a code change. A draft is never served to a patient.
  for (const r of SEED_RESOURCES) {
    if (CATHY_VERIFIED_RESOURCE_IDS.includes(r.id)) continue;
    seedDraftContent({
      typeId: "community_resource",
      id: r.id,
      body: structuredClone(r) as unknown as Record<string, unknown>,
    });
  }
}

applyRecordedVerifications();
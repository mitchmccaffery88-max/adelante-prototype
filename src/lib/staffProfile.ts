// §Group 1 (8 Oct team call) — staff profile, bookable roles, specialty /
// care-type tags and site services. All Draft — pending clinical sign-off.
//
// - isBookableRole is the ONE rule for who may be offered as a bookable
//   provider (staff Book-a-visit drawer, patient self-booking, reschedule and
//   bookable availability all read it through clinicianAvailability).
// - The specialty tag list is also the care-type list on blocks of weekly
//   hours, and each site carries a "Services offered" list from it.
// - Profile primary / secondary locations decide which sites a person may
//   add working hours for. Chart entry is NOT read from here: it stays the
//   staff calendar's hours (chartAccess.staffSiteIds).
//
// Deliberately imports nothing from workingCalendar (that module imports
// this one for its hours checks).
import { AdelanteEHR, type ServiceType } from "./ehr";
import { AdelanteEHRExt, ehrBus, type AvailabilityBlock } from "./ehr-ext";
import { listSites, saveSite, seedProviderReference, listOrganizations } from "./providerReference";
import { getStaffMember, STAFF_ROSTER, type StaffRole } from "./roles";

export const PROFILE_DRAFT_LABEL = "Draft — pending clinical sign-off";

// ------------------------------------------------------------ bookable roles
export const BOOKABLE_ROLES: readonly StaffRole[] = [
  "physician", "pmhnp", "nurse_rn", "lvn", "therapist", "sud_counselor",
  "clinical_trainee", "ecm_provider", "cf_care_manager", "peer_specialist",
  "community_health_worker", "clinical_coordinator",
];
/** Clinical roles that see patients. Medical assistants and admin roles never are. */
export const isBookableRole = (role: StaffRole | undefined): boolean => !!role && BOOKABLE_ROLES.includes(role);
/** Staff member linked to a clinician (calendar) record. */
export const staffForClinician = (clinicianId: string) => STAFF_ROSTER.find((s) => s.clinicianId === clinicianId || s.id === clinicianId);
/** A clinician record is bookable when its linked staff member holds a bookable role (unlinked legacy records stay bookable). */
export function isBookableClinician(clinicianId: string): boolean {
  const s = staffForClinician(clinicianId);
  return !s || isBookableRole(s.role);
}
export const availabilityPageTitle = (role: StaffRole) => (isBookableRole(role) ? "My clinical availability" : "My availability");

// ------------------------------------------------------------ tag list
export interface CareTag {
  id: string;
  label: string;
  /** Visit types this tag covers when it is a care type on hours / a site service. */
  serviceTypes: ServiceType[];
  draft: boolean;
  retired?: boolean;
}
export const TAG_EDIT_ROLES: readonly StaffRole[] = ["sys_admin", "clinical_coordinator"];
export const canEditTagList = (r: StaffRole) => TAG_EDIT_ROLES.includes(r);
export const canEditSiteServices = canEditTagList;

let tags: CareTag[] = [];
const siteServicesMap = new Map<string, string[]>();
interface StaffProfile { ownerId: string; specialtyTags: string[]; primarySiteId?: string; secondarySiteIds: string[] }
const profiles = new Map<string, StaffProfile>();
const nid = () => Math.random().toString(36).slice(2, 9);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const changed = (id = "profile") => ehrBus.publish({ type: "availability.updated", clinicianId: id });

export interface ProfileActor { role: StaffRole; staffId?: string; staffName?: string; clinicianId?: string }
function needReason(r?: string) {
  const v = (r ?? "").trim();
  if (v.length < 3) throw new Error("Give a short reason.");
  return v.slice(0, 300);
}
function audit(actor: ProfileActor, action: string, detail: Record<string, unknown>) {
  AdelanteEHR.recordActionEvent({ action: `profile.${action}`, actorRole: actor.role, actorId: actor.staffId, detail });
}

export const listCareTags = (opts: { includeRetired?: boolean } = {}) => tags.filter((t) => opts.includeRetired || !t.retired).map((t) => ({ ...t }));
export const careTagLabel = (id: string) => tags.find((t) => t.id === id)?.label ?? id;

export function addCareTag(actor: ProfileActor, input: { label: string; serviceTypes?: ServiceType[]; reason: string }): CareTag {
  if (!canEditTagList(actor.role)) throw new Error("Only a system administrator or clinical coordinator can edit the tag list.");
  const reason = needReason(input.reason);
  const label = input.label.trim().slice(0, 60);
  if (label.length < 2) throw new Error("Name the tag.");
  const id = slug(label);
  if (tags.some((t) => t.id === id && !t.retired)) throw new Error("That tag already exists.");
  const tag: CareTag = { id, label, serviceTypes: input.serviceTypes ?? [], draft: true };
  tags = [...tags.filter((t) => t.id !== id), tag];
  audit(actor, "tag_added", { tagId: id, reason });
  changed();
  return tag;
}
export function renameCareTag(actor: ProfileActor, input: { tagId: string; label: string; reason: string }): void {
  if (!canEditTagList(actor.role)) throw new Error("Only a system administrator or clinical coordinator can edit the tag list.");
  const reason = needReason(input.reason);
  const t = tags.find((x) => x.id === input.tagId);
  if (!t) throw new Error("Tag not found.");
  t.label = input.label.trim().slice(0, 60) || t.label;
  audit(actor, "tag_renamed", { tagId: t.id, reason });
  changed();
}
/** Retire, never delete: profiles and hours that carry it keep reading. */
export function retireCareTag(actor: ProfileActor, input: { tagId: string; reason: string }): void {
  if (!canEditTagList(actor.role)) throw new Error("Only a system administrator or clinical coordinator can edit the tag list.");
  const reason = needReason(input.reason);
  const t = tags.find((x) => x.id === input.tagId);
  if (!t) throw new Error("Tag not found.");
  t.retired = true;
  audit(actor, "tag_retired", { tagId: t.id, reason });
  changed();
}

// ------------------------------------------------------------ site services
export const siteServices = (siteId: string | undefined): string[] => (siteId ? siteServicesMap.get(siteId)?.slice() ?? listCareTags().map((t) => t.id) : []);
export function setSiteServices(actor: ProfileActor, input: { siteId: string; tagIds: string[]; reason: string }): void {
  if (!canEditSiteServices(actor.role)) throw new Error("Only a system administrator or clinical coordinator can change a site's services.");
  const reason = needReason(input.reason);
  if (!listSites().some((s) => s.id === input.siteId)) throw new Error("Pick a site.");
  const known = new Set(listCareTags().map((t) => t.id));
  siteServicesMap.set(input.siteId, [...new Set(input.tagIds.filter((t) => known.has(t)))]);
  audit(actor, "site_services_set", { siteId: input.siteId, count: siteServicesMap.get(input.siteId)!.length, reason });
  changed();
}

/** Care-type tags covering a visit type. Empty = the visit type isn't tag-mapped (no tag requirement). */
export const tagsForServiceType = (st: ServiceType) => listCareTags().filter((t) => t.serviceTypes.includes(st)).map((t) => t.id);

/**
 * Tags a block of hours effectively carries: its own care-type tags, else
 * legacy visit-type careTypes mapped to tags, else (empty) everything its
 * site offers — always intersected with the site's services.
 */
export function effectiveBlockTags(b: Pick<AvailabilityBlock, "careTypes"> & { careTags?: string[] }, siteId: string | undefined): string[] {
  const offered = siteServices(siteId);
  if (b.careTags?.length) return b.careTags.filter((t) => offered.includes(t));
  if (b.careTypes?.length) return offered.filter((t) => tags.find((x) => x.id === t)?.serviceTypes.some((st) => b.careTypes.includes(st)));
  return offered;
}
export const blockNeedsCareTypes = (b: Pick<AvailabilityBlock, "careTypes"> & { careTags?: string[] }) => !b.careTags?.length && !b.careTypes?.length;

/** One booking rule: the visit type, the block's care types and the site's services must all match. */
export function blockOffersService(b: Pick<AvailabilityBlock, "careTypes"> & { careTags?: string[] }, siteId: string | undefined, st: ServiceType | undefined): boolean {
  if (!st) return true;
  // Legacy blocks with explicit visit types keep that narrower rule too.
  if (!b.careTags?.length && b.careTypes?.length && !b.careTypes.includes(st)) return false;
  const needed = tagsForServiceType(st);
  if (!needed.length) return true;
  const eff = effectiveBlockTags(b, siteId);
  return needed.some((t) => eff.includes(t));
}

/** Throws when a block carries a care type its site doesn't offer. */
export function assertBlockTagsOffered(careTags: string[] | undefined, siteId: string | undefined): void {
  if (!careTags?.length) return;
  const offered = siteServices(siteId);
  const bad = careTags.filter((t) => !offered.includes(t));
  if (bad.length) throw new Error(`This site doesn't offer: ${bad.map(careTagLabel).join(", ")}. Pick care types the site offers.`);
}

// ------------------------------------------------------------ staff profile
export const profileOwnerFor = (staffId: string) => getStaffMember(staffId)?.clinicianId ?? staffId;
export interface StaffProfileView {
  ownerId: string;
  specialtyTags: string[];
  /** Old free text, shown only until someone picks tags. */
  previousSpecialty?: string;
  primarySiteId?: string;
  secondarySiteIds: string[];
}
export function getStaffProfile(staffIdOrOwner: string): StaffProfileView {
  const ownerId = profileOwnerFor(staffIdOrOwner);
  const p = profiles.get(ownerId);
  const legacy = AdelanteEHRExt.getClinicianProfile(ownerId)?.specialty?.trim();
  const specialtyTags = p?.specialtyTags ?? [];
  return {
    ownerId,
    specialtyTags: specialtyTags.slice(),
    previousSpecialty: !specialtyTags.length && legacy ? legacy : undefined,
    primarySiteId: p?.primarySiteId,
    secondarySiteIds: p?.secondarySiteIds.slice() ?? [],
  };
}
export const canEditProfileOf = (actor: ProfileActor, ownerId: string) =>
  canEditTagList(actor.role) || profileOwnerFor(actor.staffId ?? "") === ownerId || actor.clinicianId === ownerId;

export function saveStaffProfile(actor: ProfileActor, input: { ownerId: string; specialtyTags: string[]; primarySiteId?: string; secondarySiteIds?: string[]; reason?: string }): StaffProfileView {
  if (!canEditProfileOf(actor, input.ownerId)) throw new Error("You can only change your own profile.");
  const known = new Set(listCareTags().map((t) => t.id));
  const sites = new Set(listSites().map((s) => s.id));
  if (input.primarySiteId && !sites.has(input.primarySiteId)) throw new Error("Pick a primary facility.");
  const secondary = [...new Set((input.secondarySiteIds ?? []).filter((s) => sites.has(s) && s !== input.primarySiteId))];
  profiles.set(input.ownerId, { ownerId: input.ownerId, specialtyTags: [...new Set(input.specialtyTags.filter((t) => known.has(t)))], primarySiteId: input.primarySiteId, secondarySiteIds: secondary });
  audit(actor, "profile_saved", { ownerId: input.ownerId, tags: input.specialtyTags.length, secondary: secondary.length, reason: input.reason?.trim() || "Profile updated" });
  changed(input.ownerId);
  return getStaffProfile(input.ownerId);
}
/** Sites this person may add working hours for: primary + secondary; all sites until a primary is chosen. */
export function hourSitesFor(ownerId: string): string[] {
  const p = getStaffProfile(ownerId);
  if (!p.primarySiteId) return listSites().map((s) => s.id);
  return [p.primarySiteId, ...p.secondarySiteIds];
}

// ------------------------------------------------------------ freeze bookings
export function setBookingsFrozen(actor: ProfileActor, input: { clinicianId: string; frozen: boolean; reason: string }): void {
  if (!canEditProfileOf(actor, input.clinicianId)) throw new Error("You can only freeze your own bookings.");
  const reason = needReason(input.reason);
  if (!AdelanteEHRExt.getClinicianProfile(input.clinicianId))
    AdelanteEHRExt.upsertClinicianProfile({ clinicianId: input.clinicianId, active: true, specialty: "", credentialType: "LCSW", careTypes: [], languages: ["English"] });
  AdelanteEHRExt.setClinicianActive(input.clinicianId, !input.frozen, reason);
  audit(actor, input.frozen ? "bookings_frozen" : "bookings_reactivated", { clinicianId: input.clinicianId, reason });
  changed(input.clinicianId);
}
export const bookingsFrozen = (clinicianId: string) => AdelanteEHRExt.getClinicianProfile(clinicianId)?.active === false;

// ------------------------------------------------------------ seed
export const DEMO_SECOND_SITE = "Premier Hanford (Draft demo)";
let seeded = false;
export function seedStaffProfiles(): void {
  if (seeded) return;
  seeded = true;
  const sys: ProfileActor = { role: "sys_admin", staffId: "system" };
  const starter: [string, ServiceType[]][] = [
    ["Individual therapy", ["therapy_individual"]],
    ["Group facilitation", ["therapy_group", "sud_group_odf", "sud_group_iot"]],
    ["SUD counseling", ["sud_counseling", "sud_group_odf", "sud_group_iot"]],
    ["MAT / prescribing", ["med_management"]],
    ["Psychiatric evaluation", ["intake"]],
    ["Trauma-focused care", ["therapy_individual"]],
    ["Reentry / justice-involved", ["case_management", "care_coordination"]],
    ["Family therapy", ["therapy_individual"]],
    ["Care coordination", ["case_management", "care_coordination", "intake"]],
    ["Peer support", ["peer_support"]],
    ["Spanish-speaking", []],
  ];
  for (const [label, st] of starter) if (!tags.some((t) => t.id === slug(label))) addCareTag(sys, { label, serviceTypes: st, reason: "Draft starter list — pending clinical sign-off" });
  seedProviderReference();
  const orgId = listOrganizations()[0]?.id;
  if (orgId && !listSites().some((s) => s.name === DEMO_SECOND_SITE)) {
    const visalia = listSites().find((s) => s.name === "Premier Visalia");
    const { id: _vid, ...base } = (visalia ?? {}) as Record<string, unknown>;
    void _vid;
    saveSite({ role: "sys_admin" }, { ...base, orgId, name: DEMO_SECOND_SITE, address: "000 Placeholder St, Hanford, CA 00000", county: "Kings", programsOffered: ["outpatient_mh"], placeholder: true } as never);
  }
  for (const s of listSites()) {
    if (siteServicesMap.has(s.id)) continue;
    const all = listCareTags().map((t) => t.id);
    // Draft: the Hanford demo site runs individual work only — no groups, no MAT.
    const ids = s.name === DEMO_SECOND_SITE ? all.filter((t) => !["group-facilitation", "mat-prescribing", "sud-counseling"].includes(t)) : all;
    setSiteServices(sys, { siteId: s.id, tagIds: ids, reason: "Draft seed — services offered, pending clinical sign-off" });
  }
}
/** Test hook. */
export function _resetStaffProfiles(): void {
  profiles.clear();
}
seedStaffProfiles();

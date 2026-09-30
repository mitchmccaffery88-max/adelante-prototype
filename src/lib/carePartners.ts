// §Batch E2 — External Care Partners. Staff-facing only; no partner portal.
// Draft — pending clinical sign-off.
//
// A partner organization belongs to ONE cluster; the cluster fixes which data
// classes can ever be handed off to it. Therapy / psychotherapy notes are
// never in any slice. Linking a patient to a partner requires consent; the
// clinical-handoff cluster carries SUD content and every handoff there goes
// through `disclose()` (Part 2). The handoff log stores class NAMES only.
// SUD-based links (clinical handoff cluster, or an NTP) are hidden from staff
// who fail `roleSeesAsamSection`.
import { AdelanteEHR, type Patient } from "@/lib/ehr";
import type { StaffRole } from "@/lib/roles";
import { roleSeesAsamSection } from "@/lib/asamReporting";
import { disclose, part2ConsentFor, type Part2RecordClass } from "@/lib/part2Disclosure";

export const CARE_PARTNER_DRAFT_LABEL = "Draft — pending clinical sign-off";

export type PartnerCluster = "pre_release" | "clinical_handoff" | "benefits" | "outreach";
export type PartnerDataClass =
  | "Care plan"
  | "Appointments"
  | "Consent status"
  | "MAT status"
  | "Diagnoses"
  | "Medications"
  | "Enrollment status"
  | "Social needs (SDOH)"
  | "Minimal clinical summary";

export const PARTNER_CLUSTERS: Record<PartnerCluster, { label: string; slice: PartnerDataClass[]; part2: boolean }> = {
  pre_release: { label: "Pre-release coordination", slice: ["Care plan", "Appointments", "Consent status"], part2: false },
  clinical_handoff: { label: "Clinical handoff", slice: ["MAT status", "Diagnoses", "Medications"], part2: true },
  benefits: { label: "Benefits", slice: ["Enrollment status"], part2: false },
  outreach: { label: "Outreach", slice: ["Social needs (SDOH)", "Appointments", "Minimal clinical summary"], part2: false },
};
/** Never handed off to any partner. */
export const NEVER_SHARED = ["Therapy notes", "Psychotherapy notes"] as const;

const PART2_CLASS: Partial<Record<PartnerDataClass, Part2RecordClass>> = {
  "MAT status": "SUD medications",
  Medications: "SUD medications",
  Diagnoses: "SUD diagnoses",
};

export type PartnerOrgType = "ntp" | "correctional_facility" | "health_plan" | "community_org" | "clinic";
export const PARTNER_ORG_TYPE_LABEL: Record<PartnerOrgType, string> = {
  ntp: "Narcotic Treatment Program (NTP)",
  correctional_facility: "Correctional facility",
  health_plan: "Health plan",
  community_org: "Community organization",
  clinic: "Clinic",
};

export interface PartnerOrg {
  id: string;
  name: string;
  type: PartnerOrgType;
  cluster: PartnerCluster;
  city?: string;
  fictional?: boolean;
}
export interface PartnerContact {
  id: string;
  orgId: string;
  name: string;
  title?: string;
  phone?: string;
}
export interface PartnerLink {
  id: string;
  patientId: string;
  orgId: string;
  cluster: PartnerCluster;
  purpose: string;
  consentRef: string;
  createdBy: string;
  createdAt: string;
  endedAt?: string;
}
export interface PartnerHandoff {
  id: string;
  linkId: string;
  patientId: string;
  orgId: string;
  at: string;
  by: string;
  role: string;
  /** Class names only — never content. */
  classes: PartnerDataClass[];
}

type Actor = { role: StaffRole | string; staffId?: string; name: string };

const orgs: PartnerOrg[] = [];
const contacts: PartnerContact[] = [];
const links: PartnerLink[] = [];
const handoffs: PartnerHandoff[] = [];
const uid = () => Math.random().toString(36).slice(2, 10);

export const PARTNER_DIRECTORY_EDIT_ROLES = ["sys_admin"];
export const PARTNER_DIRECTORY_READ_ROLES = ["sys_admin", "clinical_coordinator", "ecm_provider", "cf_care_manager"];
/** Roles that see the chart Care partners section (and may link / hand off). */
export const PARTNER_CHART_ROLES = [
  "clinical_coordinator",
  "ecm_provider",
  "cf_care_manager",
  "therapist",
  "pmhnp",
  "physician",
  "sud_counselor",
  "nurse_rn",
];
export const canEditPartnerDirectory = (role: string) => PARTNER_DIRECTORY_EDIT_ROLES.includes(role);
export const canReadPartnerDirectory = (role: string) => PARTNER_DIRECTORY_READ_ROLES.includes(role);
export const canSeeCarePartners = (role: string) => PARTNER_CHART_ROLES.includes(role);
export const canLinkPartner = (role: string) => PARTNER_CHART_ROLES.includes(role);

function assertRole(actor: Actor, roles: string[], what: string) {
  if (!roles.includes(actor.role)) throw new Error(`Your role can't ${what}.`);
}
function patientOf(id: string): Patient {
  const p = AdelanteEHR.getPatient(id);
  if (!p) throw new Error("Patient not found.");
  return p;
}
function audit(action: string, patientId: string | undefined, actor: Actor, detail: Record<string, unknown>) {
  AdelanteEHR._recordAudit({ category: "disclosure", action, patientId, actorId: actor.staffId ?? actor.name, actorRole: actor.role, detail });
  AdelanteEHR._emit();
}

export const isSudPartner = (o: PartnerOrg) => o.type === "ntp" || PARTNER_CLUSTERS[o.cluster].part2;
export const partnerOrg = (id: string) => orgs.find((o) => o.id === id);
export const listPartnerOrgs = () => [...orgs].sort((a, b) => a.name.localeCompare(b.name));
export const listPartnerContacts = (orgId: string) => contacts.filter((c) => c.orgId === orgId);

// ------------------------------------------------------------- directory
export function savePartnerOrg(input: Omit<PartnerOrg, "id"> & { id?: string; actor: Actor }): PartnerOrg {
  assertRole(input.actor, PARTNER_DIRECTORY_EDIT_ROLES, "edit the care partner directory");
  if (input.name.trim().length < 2) throw new Error("Enter the organization name.");
  if (!PARTNER_CLUSTERS[input.cluster]) throw new Error("Pick a cluster.");
  const existing = input.id ? orgs.find((o) => o.id === input.id) : undefined;
  const { actor, ...fields } = input;
  if (existing) {
    // The cluster fixes the data slice — changing it on an org with live links would widen sharing.
    if (existing.cluster !== fields.cluster && links.some((l) => l.orgId === existing.id && !l.endedAt))
      throw new Error("End this partner's patient links before changing its cluster.");
    Object.assign(existing, { ...fields, name: fields.name.trim(), id: existing.id });
    audit("care_partner_org_updated", undefined, actor, { orgId: existing.id, cluster: existing.cluster });
    return existing;
  }
  const o: PartnerOrg = { ...fields, name: fields.name.trim(), id: input.id ?? `cp-${uid()}` };
  orgs.push(o);
  audit("care_partner_org_added", undefined, actor, { orgId: o.id, cluster: o.cluster });
  return o;
}
export function savePartnerContact(input: Omit<PartnerContact, "id"> & { id?: string; actor: Actor }): PartnerContact {
  assertRole(input.actor, PARTNER_DIRECTORY_EDIT_ROLES, "edit the care partner directory");
  if (!partnerOrg(input.orgId)) throw new Error("Organization not found.");
  if (input.name.trim().length < 2) throw new Error("Enter the contact name.");
  const { actor, ...fields } = input;
  const c: PartnerContact = { ...fields, name: fields.name.trim(), id: input.id ?? `cpc-${uid()}` };
  contacts.push(c);
  audit("care_partner_contact_added", undefined, actor, { orgId: c.orgId, contactId: c.id });
  return c;
}

// ------------------------------------------------------------------ links
/** Why this role can't see a link/org for this patient (Part 2), or undefined. */
function hiddenForRole(role: string, o: PartnerOrg, p: Patient | undefined): boolean {
  return isSudPartner(o) && !(p && roleSeesAsamSection(role as StaffRole, p));
}

export function linkPartner(input: { patientId: string; orgId: string; purpose: string; actor: Actor }): PartnerLink {
  assertRole(input.actor, PARTNER_CHART_ROLES, "link care partners");
  const p = patientOf(input.patientId);
  const o = partnerOrg(input.orgId);
  if (!o) throw new Error("Partner not found.");
  if (hiddenForRole(input.actor.role, o, p)) throw new Error("Not available for your role.");
  if (input.purpose.trim().length < 3) throw new Error("Say why this partner is linked.");
  if (links.some((l) => l.patientId === p.id && l.orgId === o.id && !l.endedAt)) throw new Error("This partner is already linked.");
  const consent = part2ConsentFor(p.id, { name: o.name, type: o.type === "ntp" || o.type === "clinic" ? "provider" : "other", organization: o.name }, input.purpose.trim());
  if (!consent.ok) {
    audit("care_partner_link_blocked", p.id, input.actor, { orgId: o.id, why: "consent_missing" });
    throw new Error("The person hasn't signed a consent that covers this partner. Record the consent first.");
  }
  const l: PartnerLink = {
    id: uid(), patientId: p.id, orgId: o.id, cluster: o.cluster, purpose: input.purpose.trim(), consentRef: consent.ref,
    createdBy: input.actor.name, createdAt: new Date().toISOString(),
  };
  links.push(l);
  audit("care_partner_linked", p.id, input.actor, { linkId: l.id, cluster: l.cluster });
  return l;
}
export function endPartnerLink(input: { linkId: string; actor: Actor }): PartnerLink {
  assertRole(input.actor, PARTNER_CHART_ROLES, "end care partner links");
  const l = links.find((x) => x.id === input.linkId);
  if (!l || l.endedAt) throw new Error("Link not found.");
  const o = partnerOrg(l.orgId)!;
  if (hiddenForRole(input.actor.role, o, AdelanteEHR.getPatient(l.patientId))) throw new Error("Not available for your role.");
  l.endedAt = new Date().toISOString();
  audit("care_partner_link_ended", l.patientId, input.actor, { linkId: l.id });
  return l;
}

/** Links visible to this role — SUD-based links are removed entirely (not stubbed). */
export function visiblePartnerLinks(patientId: string, role: string): PartnerLink[] {
  if (!canSeeCarePartners(role)) return [];
  const p = AdelanteEHR.getPatient(patientId);
  return links.filter((l) => l.patientId === patientId && !hiddenForRole(role, partnerOrg(l.orgId)!, p));
}
/** Directory rows this role may pick for this patient. */
export function linkablePartners(patientId: string, role: string): PartnerOrg[] {
  const p = AdelanteEHR.getPatient(patientId);
  return listPartnerOrgs().filter((o) => !hiddenForRole(role, o, p));
}

// --------------------------------------------------------------- handoffs
export function recordHandoff(input: { linkId: string; classes: string[]; actor: Actor }): PartnerHandoff {
  assertRole(input.actor, PARTNER_CHART_ROLES, "hand off to care partners");
  const l = links.find((x) => x.id === input.linkId);
  if (!l || l.endedAt) throw new Error("This partner link isn't active.");
  const o = partnerOrg(l.orgId)!;
  const p = patientOf(l.patientId);
  if (hiddenForRole(input.actor.role, o, p)) throw new Error("Not available for your role.");
  if (input.classes.length === 0) throw new Error("Pick what was shared.");
  if (input.classes.some((c) => /therapy|psychotherapy/i.test(c))) throw new Error("Therapy notes are never shared with care partners.");
  const slice = PARTNER_CLUSTERS[l.cluster].slice as string[];
  const outside = input.classes.filter((c) => !slice.includes(c));
  if (outside.length) throw new Error(`${PARTNER_CLUSTERS[l.cluster].label} partners can't receive: ${outside.join(", ")}.`);
  const classes = input.classes as PartnerDataClass[];
  if (PARTNER_CLUSTERS[l.cluster].part2) {
    const recordClasses = [...new Set(classes.map((c) => PART2_CLASS[c]).filter(Boolean))] as Part2RecordClass[];
    const res = disclose({
      patientId: p.id,
      actor: { name: input.actor.name, role: input.actor.role, staffId: input.actor.staffId },
      recipient: { name: o.name, type: "provider", organization: o.name },
      purpose: l.purpose,
      channel: "care_partner_handoff",
      recordClasses,
    });
    if (!res.ok) throw new Error(res.reason);
  }
  const h: PartnerHandoff = { id: uid(), linkId: l.id, patientId: p.id, orgId: o.id, at: new Date().toISOString(), by: input.actor.name, role: input.actor.role, classes };
  handoffs.push(h);
  audit("care_partner_handoff", p.id, input.actor, { linkId: l.id, classes });
  return h;
}
export function visibleHandoffs(patientId: string, role: string): PartnerHandoff[] {
  const ok = new Set(visiblePartnerLinks(patientId, role).map((l) => l.id));
  return handoffs.filter((h) => ok.has(h.linkId)).sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

// -------------------------------------------------------------- demo seed
export const DEMO_NTP_ID = "cp-ntp-sequoia";
let seeded = false;
export function seedCarePartnersDemo(): void {
  if (seeded) return;
  seeded = true;
  const actor = { role: "sys_admin", staffId: "s-admin1", name: "Adelante System Admin" };
  const add = (o: Omit<PartnerOrg, "fictional">, people: Omit<PartnerContact, "id" | "orgId">[]) => {
    savePartnerOrg({ ...o, fictional: true, actor });
    for (const c of people) savePartnerContact({ ...c, orgId: o.id, actor });
  };
  add({ id: DEMO_NTP_ID, name: "Sequoia Valley Treatment Program (fictional NTP)", type: "ntp", cluster: "clinical_handoff", city: "Visalia" }, [
    { name: "Dana Whitfield", title: "Intake coordinator", phone: "(559) 555-0141" },
  ]);
  add({ id: "cp-tcjail", name: "Tulare County Adult Pre-Trial Facility (fictional)", type: "correctional_facility", cluster: "pre_release", city: "Visalia" }, [
    { name: "Sgt. Lorena Amaya", title: "Reentry liaison", phone: "(559) 555-0172" },
  ]);
  add({ id: "cp-plan", name: "Central Valley Health Plan (fictional)", type: "health_plan", cluster: "benefits", city: "Fresno" }, [
    { name: "Marcus Bell", title: "Enrollment specialist", phone: "(559) 555-0118" },
  ]);
  add({ id: "cp-cbo", name: "Porterville Community Resource Center (fictional)", type: "community_org", cluster: "outreach", city: "Porterville" }, [
    { name: "Yesenia Flores", title: "Outreach lead", phone: "(559) 555-0190" },
  ]);
}
seedCarePartnersDemo();

/** Test hook: link without seed noise. */
export function _resetCarePartnerLinks(): void {
  links.length = 0;
  handoffs.length = 0;
}

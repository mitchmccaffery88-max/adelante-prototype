// §Batch A1 — Provider & site reference: Organization → Sites → Programs.
//
// The future DHCS Master Provider File / 274 match, and the per-county /
// per-program configuration the platform uses beyond Tulare. Practitioner
// NPIs are NOT stored here: they are read from the staff roster (roles.ts
// `npi`), so there is one NPI store.
//
// Seed values for Premier Visalia are obviously fake placeholders.
import type { FundingLane } from "@/lib/ehr";
import { STAFF_ROSTER, type StaffRole } from "@/lib/roles";

export const PLACEHOLDER_LABEL = "Simulated — placeholder values, not checked against the DHCS Master Provider File";
export const MPF_MATCH_LABEL = "MPF match: Simulated — not checked";
export const CADENCE_DRAFT_LABEL = "Draft — pending clinical sign-off";

export const SITE_PROGRAM_OPTIONS = [
  { id: "odf", label: "Outpatient drug free (ODF)" },
  { id: "iot", label: "Intensive outpatient (IOT)" },
  { id: "nm_mat", label: "Non-methadone MAT" },
  { id: "afbi", label: "Field outreach (AFBI)" },
  { id: "outpatient_mh", label: "Outpatient mental health" },
] as const;
export type SiteProgramOption = (typeof SITE_PROGRAM_OPTIONS)[number]["id"];

export interface Organization {
  id: string;
  name: string;
}
export interface Site {
  id: string;
  orgId: string;
  name: string;
  address: string;
  county: string;
  dmcCertNumber: string;
  dmcCertExpires: string;
  calomsProviderNumber: string;
  datarProviderId: string;
  npiType2: string;
  mediCalProviderNumber: string;
  programsOffered: SiteProgramOption[];
  placeholder: boolean;
}
export interface ReportingCadence {
  report: "CalOMS" | "DATAR";
  cadence: "monthly";
  dueDay: number;
}
export interface Program {
  id: string;
  siteId: string;
  name: string;
  levelsOfCare: string[];
  allowedFundingLanes: FundingLane[];
  countyContract: string;
  reporting: ReportingCadence[];
}

export const PROVIDER_REF_EDIT_ROLES: readonly StaffRole[] = ["sys_admin"];
/**
 * There is no dedicated compliance role yet; credentialing coordinator stands
 * in for compliance read access, alongside the billing roles.
 */
export const PROVIDER_REF_READ_ROLES: readonly StaffRole[] = ["sys_admin", "billing", "billing_coordinator", "credentialing_coordinator"];
export const canEditProviderRef = (r: StaffRole) => PROVIDER_REF_EDIT_ROLES.includes(r);
export const canReadProviderRef = (r: StaffRole) => PROVIDER_REF_READ_ROLES.includes(r);

const orgs: Organization[] = [];
const sites: Site[] = [];
const programs: Program[] = [];
let seq = 0;

const SITE_REQUIRED: (keyof Site)[] = ["name", "address", "county", "dmcCertNumber", "dmcCertExpires", "calomsProviderNumber", "datarProviderId", "npiType2", "mediCalProviderNumber"];
export const SITE_FIELD_LABEL: Record<string, string> = {
  name: "Site name",
  address: "Address",
  county: "County",
  dmcCertNumber: "DMC certification number",
  dmcCertExpires: "DMC certification expiry",
  calomsProviderNumber: "CalOMS provider number",
  datarProviderId: "DATAR provider ID",
  npiType2: "Type-2 NPI",
  mediCalProviderNumber: "Medi-Cal provider number",
  programsOffered: "Programs offered",
};

function assertEdit(role: StaffRole) {
  if (!canEditProviderRef(role)) throw new Error("Only a system administrator can edit provider & site reference.");
}

export function saveOrganization(actor: { role: StaffRole }, input: { id?: string; name: string }): Organization {
  assertEdit(actor.role);
  if (!input.name.trim()) throw new Error("Enter the organization name.");
  const existing = input.id ? orgs.find((o) => o.id === input.id) : undefined;
  if (existing) {
    existing.name = input.name.trim();
    return existing;
  }
  const o = { id: `org-${++seq}`, name: input.name.trim() };
  orgs.push(o);
  return o;
}

export function saveSite(actor: { role: StaffRole }, input: Omit<Site, "id" | "placeholder"> & { id?: string; placeholder?: boolean }): Site {
  assertEdit(actor.role);
  if (!orgs.some((o) => o.id === input.orgId)) throw new Error("Pick an organization.");
  if (!input.name.trim()) throw new Error("Enter the site name.");
  if (input.dmcCertExpires && !/^\d{4}-\d{2}-\d{2}$/.test(input.dmcCertExpires)) throw new Error("Enter the certification expiry as a date.");
  if (input.npiType2 && !/^\d{10}$/.test(input.npiType2)) throw new Error("A type-2 NPI is 10 digits.");
  const clean = { ...input, programsOffered: [...new Set(input.programsOffered)], placeholder: input.placeholder ?? false };
  const existing = input.id ? sites.find((s) => s.id === input.id) : undefined;
  if (existing) {
    // An edit by a person is no longer the seeded placeholder unless kept so.
    Object.assign(existing, clean, { placeholder: input.placeholder ?? false });
    return existing;
  }
  const s: Site = { ...clean, id: `site-${++seq}` };
  sites.push(s);
  return s;
}

export function saveProgram(actor: { role: StaffRole }, input: Omit<Program, "id"> & { id?: string }): Program {
  assertEdit(actor.role);
  if (!sites.some((s) => s.id === input.siteId)) throw new Error("Pick a site.");
  if (!input.name.trim()) throw new Error("Enter the program name.");
  if (!input.allowedFundingLanes.length) throw new Error("Pick at least one funding lane.");
  const existing = input.id ? programs.find((p) => p.id === input.id) : undefined;
  if (existing) {
    Object.assign(existing, input);
    return existing;
  }
  const p: Program = { ...input, id: `prg-${++seq}` };
  programs.push(p);
  return p;
}

export const listOrganizations = () => orgs.slice();
export const listSites = (orgId?: string) => sites.filter((s) => !orgId || s.orgId === orgId);
export const listPrograms = (siteId?: string) => programs.filter((p) => !siteId || p.siteId === siteId);
/** Per-county configuration (expansion beyond Tulare). */
export function programConfigForCounty(county: string): { site: Site; programs: Program[] }[] {
  return sites.filter((s) => s.county.toLowerCase() === county.toLowerCase()).map((site) => ({ site, programs: listPrograms(site.id) }));
}

/** Rendering practitioners and their NPI, read from the staff roster. */
export function renderingPractitioners(): { staffId: string; name: string; role: StaffRole; npi?: string }[] {
  return STAFF_ROSTER.filter((s) => s.clinicianId).map((s) => ({ staffId: s.id, name: s.name, role: s.role, npi: s.npi }));
}

export interface ProviderReadiness {
  missing: { siteId: string; siteName: string; field: string }[];
  expiring: { siteId: string; siteName: string; expires: string; daysLeft: number }[];
  practitionersMissingNpi: number;
  placeholderSites: number;
  mpfMatch: typeof MPF_MATCH_LABEL;
}
export function providerReadiness(now = new Date()): ProviderReadiness {
  const missing: ProviderReadiness["missing"] = [];
  const expiring: ProviderReadiness["expiring"] = [];
  for (const s of sites) {
    for (const f of SITE_REQUIRED) if (!String(s[f] ?? "").trim()) missing.push({ siteId: s.id, siteName: s.name, field: SITE_FIELD_LABEL[f]! });
    if (!s.programsOffered.length) missing.push({ siteId: s.id, siteName: s.name, field: SITE_FIELD_LABEL.programsOffered! });
    if (s.dmcCertExpires) {
      const daysLeft = Math.ceil((new Date(`${s.dmcCertExpires}T00:00:00Z`).getTime() - now.getTime()) / 86_400_000);
      if (daysLeft <= 90) expiring.push({ siteId: s.id, siteName: s.name, expires: s.dmcCertExpires, daysLeft });
    }
  }
  return {
    missing,
    expiring,
    practitionersMissingNpi: renderingPractitioners().filter((p) => !p.npi).length,
    placeholderSites: sites.filter((s) => s.placeholder).length,
    mpfMatch: MPF_MATCH_LABEL,
  };
}

export const DRAFT_REPORTING: ReportingCadence[] = [
  { report: "CalOMS", cadence: "monthly", dueDay: 15 },
  { report: "DATAR", cadence: "monthly", dueDay: 10 },
];

/** Demo seed — runs through the normal store functions as the system admin. */
export function seedProviderReference(now = new Date()): void {
  if (orgs.length) return;
  const admin = { role: "sys_admin" as StaffRole };
  const org = saveOrganization(admin, { name: "Premier (demo)" });
  const exp = new Date(now.getTime() + 75 * 86_400_000).toISOString().slice(0, 10);
  const site = saveSite(admin, {
    orgId: org.id,
    name: "Premier Visalia",
    address: "000 Placeholder Ave, Visalia, CA 00000",
    county: "Tulare",
    dmcCertNumber: "DMC-0000-TEST",
    dmcCertExpires: exp,
    calomsProviderNumber: "CALOMS-000000",
    datarProviderId: "DATAR-000000",
    npiType2: "0000000000",
    mediCalProviderNumber: "",
    programsOffered: ["odf", "iot", "nm_mat", "afbi", "outpatient_mh"],
    placeholder: true,
  });
  saveProgram(admin, {
    siteId: site.id,
    name: "Outpatient SUD (DMC-ODS)",
    levelsOfCare: ["ASAM 1.0", "ASAM 2.1", "OTP-excluded non-methadone MAT"],
    allowedFundingLanes: ["dmc_ods", "isl_non_medi_cal"],
    countyContract: "Tulare County BH — placeholder contract 0000",
    reporting: DRAFT_REPORTING,
  });
  saveProgram(admin, {
    siteId: site.id,
    name: "Field outreach (AFBI)",
    levelsOfCare: ["Outreach & engagement"],
    allowedFundingLanes: ["isl_non_medi_cal"],
    countyContract: "Tulare County BH — placeholder contract 0000",
    reporting: DRAFT_REPORTING,
  });
  saveProgram(admin, {
    siteId: site.id,
    name: "Outpatient mental health",
    levelsOfCare: ["Outpatient"],
    allowedFundingLanes: ["medi_cal_ffs", "isl_non_medi_cal", "private_pay"],
    countyContract: "Tulare County MHP — placeholder contract 0000",
    reporting: [{ report: "CalOMS", cadence: "monthly", dueDay: 15 }],
  });
}
seedProviderReference();

export function _resetProviderReference(): void {
  orgs.length = 0;
  sites.length = 0;
  programs.length = 0;
}

// §Group 2 O1/O2 — emergency contacts and the advocate are two separate
// records, linked (AdvocateLink.contactId), never copied silently. Lists are
// Draft; Spanish is Draft.
import type { AdvocateLink, EmergencyContact } from "@/lib/ehr";
import type { AdvocateAuthorizationType } from "@/lib/advocate";

export const CONTACT_LISTS_DRAFT_LABEL = "Draft — pending clinical sign-off";

export const RELATIONSHIPS = [
  { id: "parent", en: "Parent", es: "Padre o madre" },
  { id: "spouse_partner", en: "Spouse or partner", es: "Esposo/a o pareja" },
  { id: "child", en: "Child", es: "Hijo/a" },
  { id: "sibling", en: "Sibling", es: "Hermano/a" },
  { id: "other_family", en: "Other family", es: "Otro familiar" },
  { id: "friend", en: "Friend", es: "Amigo/a" },
  { id: "sponsor_peer", en: "Sponsor or peer mentor", es: "Padrino/madrina o mentor de pares" },
  { id: "case_manager", en: "Case manager or counselor", es: "Administrador de casos o consejero" },
  { id: "other", en: "Other", es: "Otro" },
] as const;
export type RelationshipId = (typeof RELATIONSHIPS)[number]["id"];

/** Stored text: the English label, or "Other: …" when Other is chosen. */
export function relationshipText(id: string, other?: string): string {
  if (id === "other") return other?.trim() ? `Other: ${other.trim().slice(0, 60)}` : "Other";
  return RELATIONSHIPS.find((r) => r.id === id)?.en ?? "";
}
/** Parse stored text back into the dropdown. Legacy free text becomes Other. */
export function relationshipFromText(text: string): { id: RelationshipId | ""; other: string } {
  const t = text.trim();
  if (!t) return { id: "", other: "" };
  const hit = RELATIONSHIPS.find((r) => r.en.toLowerCase() === t.toLowerCase());
  if (hit) return { id: hit.id, other: "" };
  return { id: "other", other: t.replace(/^Other:\s*/i, "") };
}

export const ADVOCATE_TYPES: { id: string; en: string; es: string; auth: AdvocateAuthorizationType }[] = [
  { id: "family", en: "Family member or friend helping with my care", es: "Familiar o amigo que ayuda con mi cuidado", auth: "family_participation" },
  { id: "authorized_rep", en: "Authorized representative", es: "Representante autorizado", auth: "dhcs_authorized_representative" },
  { id: "ahcd_agent", en: "Agent under my advance health care directive", es: "Agente de mi directiva anticipada de salud", auth: "ahcd" },
  { id: "conservator", en: "Court-appointed conservator", es: "Curador nombrado por la corte", auth: "conservatorship" },
];
export const authorizationForAdvocateType = (id: string) => ADVOCATE_TYPES.find((t) => t.id === id)?.auth;

const PHONE_RE = /^\+?[\d\s().-]{10,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validPhone = (v: string) => PHONE_RE.test(v.trim()) && v.replace(/\D/g, "").length >= 10;
export const validEmail = (v: string) => EMAIL_RE.test(v.trim()) && v.trim().length <= 255;

export interface AdvocateDraft {
  name: string;
  relationshipId: string;
  relationshipOther: string;
  typeId: string;
  phone: string;
  email: string;
  sendBy: "sms" | "email";
  contactId?: string;
}
export const emptyAdvocateDraft = (): AdvocateDraft => ({ name: "", relationshipId: "", relationshipOther: "", typeId: "", phone: "", email: "", sendBy: "sms" });

export type AdvocateDraftError = "name" | "type" | "contact_missing" | "phone_invalid" | "email_invalid" | "send_by";
export function validateAdvocateDraft(d: AdvocateDraft): AdvocateDraftError[] {
  const e: AdvocateDraftError[] = [];
  if (d.name.trim().length < 2) e.push("name");
  if (!authorizationForAdvocateType(d.typeId)) e.push("type");
  const ph = d.phone.trim(), em = d.email.trim();
  if (!ph && !em) e.push("contact_missing");
  if (ph && !validPhone(ph)) e.push("phone_invalid");
  if (em && !validEmail(em)) e.push("email_invalid");
  if ((d.sendBy === "sms" && !ph) || (d.sendBy === "email" && !em)) e.push("send_by");
  return e;
}

/** "Make this person my advocate" — pre-fill from the contact and link to it. */
export function advocateDraftFromContact(c: EmergencyContact, prev: AdvocateDraft = emptyAdvocateDraft()): AdvocateDraft {
  const rel = relationshipFromText(c.relationship);
  return { ...prev, name: c.name, relationshipId: rel.id, relationshipOther: rel.other, phone: c.phone, email: c.email ?? "", sendBy: c.phone.trim() ? "sms" : "email", ...(c.id ? { contactId: c.id } : {}) };
}

/** Linked contact changed since the advocate was made from it → ask, never silently diverge. */
export function contactDrifted(link: Pick<AdvocateLink, "contactSnapshot">, c: Pick<EmergencyContact, "name" | "phone">): boolean {
  if (!link.contactSnapshot) return false;
  return link.contactSnapshot.name.trim() !== c.name.trim() || link.contactSnapshot.phone.trim() !== c.phone.trim();
}

export type AdvocateStatus = "invited" | "waiting_consent" | "waiting_signup" | "active";
/** Invited = delivery not confirmed yet (or failed — the error is shown). */
export function advocateStatus(link: Pick<AdvocateLink, "status" | "notificationDelivery">, consentActive: boolean): AdvocateStatus {
  if (link.status === "active") return "active";
  if (!consentActive) return "waiting_consent";
  return link.notificationDelivery?.status === "failed" ? "invited" : "waiting_signup";
}
export const ADVOCATE_STATUS_LABEL: Record<AdvocateStatus, { en: string; es: string }> = {
  invited: { en: "Invited", es: "Invitado" },
  waiting_consent: { en: "Waiting for your consent", es: "Esperando tu consentimiento" },
  waiting_signup: { en: "Waiting for their sign-up", es: "Esperando su registro" },
  active: { en: "Active", es: "Activo" },
};

export const newContactId = () => `ec_${Math.random().toString(36).slice(2, 10)}`;

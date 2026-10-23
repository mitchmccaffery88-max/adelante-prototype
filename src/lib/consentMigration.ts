// B2-5 — non-granting legacy history and narrowly authorized demo captures.
// Draft — pending clinical sign-off / counsel. No emergency or counseling writes.
import { AdelanteEHR, type ConsentRecord } from "./ehr";
import { PART2_ELEMENT_KEYS } from "./consentRecordModel";
import { publishedForm, type FormVersion } from "./consentForms";
import type { CaptureDraft } from "./consentCapture";
import type { RunActor, RunInput, RunResult } from "./actions/runAction";

type Runner = <T>(id: string, actor: RunActor, patient: ReturnType<typeof AdelanteEHR.getPatient>, input: RunInput) => RunResult<T>;
const actor = { role: "sys_admin" as const, staffId: "s-admin1", staffName: "Adelante System Admin" };
const storeActor = { role: "sys_admin" as const, staffId: "s-admin1", name: "Adelante System Admin" };
let runner: Runner | undefined;
let registryReady = false;
const pending: CaptureDraft[] = [];
const captured = new Set<string>();

export const NAMED_PART2_FORM: Omit<FormVersion, "id" | "version" | "status" | "placeholder" | "counsel" | "createdAt"> = {
  key: "part2_named_org",
  title: { en: "Specific Part 2 disclosure to a named organization", es: "Divulgación específica de Parte 2 a una organización nombrada (Borrador — pendiente de revisión de traducción)" },
  summary: { en: "Draft — pending counsel. Only the named organization, purpose and listed information are covered.", es: "Borrador — pendiente de revisión legal y de traducción. Solo cubre la organización, el propósito y la información que indiques." },
  body: {
    en: "Draft — pending counsel. Name the patient and one recipient organization. State the exact purpose, list each information item, and specify an expiration date or event. No other recipient, purpose or information is authorized. You may revoke this consent at any time. Your signature and date confirm only these terms. Federal law (42 CFR Part 2) protects these records and prohibits unauthorized use or redisclosure. This consent does not authorize use or disclosure in civil, criminal, administrative or legislative proceedings against you.",
    es: "Borrador — pendiente de revisión legal y de traducción. Indica tu nombre y una organización destinataria. Especifica el propósito, cada información que autorizas y una fecha o evento de vencimiento. No autorizas otros destinatarios, propósitos ni información. Puedes revocar este consentimiento en cualquier momento. Tu firma y fecha confirman solo estos términos. La ley federal (42 CFR Parte 2) protege estos registros y prohíbe su uso o divulgación no autorizados. Este consentimiento no autoriza su uso o divulgación en procedimientos civiles, penales, administrativos o legislativos contra ti.",
  },
  signatureMethod: "typed_name", pathways: "all", categories: [], audience: "patient",
  part2: { recipient: "Named organization only", what: "Listed items only", why: "Specified purpose only" },
};

function invoke<T>(id: string, via: string, args: unknown[], patientId?: string): T {
  if (!runner || !registryReady) throw new Error("Consent migration registry is not ready.");
  const result = runner<T>(id, actor, patientId ? AdelanteEHR.getPatient(patientId) : undefined, { via, args, auditReason: "B2-5 approved demo consent migration — Draft pending counsel" });
  if (!result.ok) throw new Error(result.reason);
  return result.value;
}

export function ensureNamedPart2Form(): void {
  if (publishedForm("part2_named_org")) return;
  const v = invoke<FormVersion>("consent_form_author", "createFormDraft", [NAMED_PART2_FORM, storeActor]);
  invoke("consent_form_author", "submitForLegalReview", [v.id, storeActor]);
  invoke("consent_form_publish", "approveForm", [v.id, storeActor]);
  invoke("consent_form_publish", "publishForm", [v.id, storeActor, "B2-5 named organization disclosure — Draft pending counsel and translation review"]);
}

/** Refuse invented provenance: migration never verifies or signs old history. */
export function migrateUnprovenConsents(input: { patientId: string; verify?: boolean; actor: typeof storeActor }): number {
  if (input.actor.role !== "sys_admin") throw new Error("Only sys_admin can migrate legacy consent history.");
  if (input.verify) throw new Error("A migration cannot invent a signed copy, form version or hash.");
  return AdelanteEHR.markLegacyConsentsUnverified(input.patientId);
}

function capture(draft: CaptureDraft): void {
  const key = JSON.stringify([draft.patientId, draft.consentType, draft.recipients, draft.purpose, draft.items]);
  if (captured.has(key)) return;
  if (draft.consentType === "legal_part2_disclosure") ensureNamedPart2Form();
  const p = AdelanteEHR.getPatient(draft.patientId);
  if (!p) throw new Error("Demo capture patient not found.");
  invoke<ConsentRecord>("consent_record_capture", "captureConsentRecord", [{ draft: { ...draft, part2Elements: Object.fromEntries(PART2_ELEMENT_KEYS.map(k => [k, true])), expiresOnEvent: "Patient revokes this consent" }, method: "e_sign", signer: `${p.firstName} ${p.lastName}`, relationship: "patient", attested: true, actor: storeActor }], p.id);
  captured.add(key);
}

export function requestDemoConsentCapture(draft: CaptureDraft): void {
  if (!runner || !registryReady) { pending.push(draft); return; }
  capture(draft);
}

/** Called by runAction.ts once the runner exists; seeds only when the action registry is also loaded. */
export function registerConsentMigrationRunner(run: Runner): void {
  runner = run;
  if (registryReady) seedConsentMigration();
}
/** Called once at the end of chartActions.ts (the registry), breaking the import-order race. */
export function consentMigrationRegistryReady(): void {
  registryReady = true;
  if (runner) seedConsentMigration();
}

export function seedConsentMigration(): void {
  if (!runner || !registryReady) return;
  for (const p of AdelanteEHR.listPatients()) {
    if (AdelanteEHR.listConsentRecords(p.id).some(r => !r.consentType && !r.legacyUnverified))
      invoke("consent_legacy_migrate", "migrateUnprovenConsents", [{ patientId: p.id, actor: storeActor }], p.id);
  }
  for (const [first, last] of [["Marcus", "L."], ["Luis", "Camacho"], ["Jasmine", "Holt"]]) {
    const p = AdelanteEHR.listPatients().find(p => p.firstName === first && p.lastName === last);
    if (!p) throw new Error("Authorized treatment demo patient missing.");
    requestDemoConsentCapture({ patientId: p.id, consentType: "part2_tpo_single", recipients: [{ kind: "org", name: "Adelante", directoryRef: "adelante-program" }], purpose: "treatment", purposeCode: "treatment", items: ["SUD treatment information"] });
  }
  while (pending.length) { const draft = pending.shift(); if (draft) capture(draft); }
}
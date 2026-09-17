// §Language preference — one write site for the member's real language.
//
// Before this, `Patient.preferredLanguage` was captured at signup / intake /
// the staff profile dialog and then never read again, while the header EN/ES
// toggle lived only in localStorage. Two facts, no connection. This module is
// the single place both sides go through, so they cannot drift.
import { AdelanteEHR, type PreferredLanguage } from "@/lib/ehr";

export const LANG_STORAGE_KEY = "adelante.lang";

export function isLang(v: unknown): v is PreferredLanguage {
  return v === "en" || v === "es";
}

/** The language on file for the acting member, if there is one. */
export function storedPreferredLanguage(
  patientId?: string | undefined,
): PreferredLanguage | undefined {
  const id = patientId ?? AdelanteEHR.getCurrentPatientId();
  if (!id) return undefined;
  const p = AdelanteEHR.getPatient(id);
  return isLang(p?.preferredLanguage) ? p.preferredLanguage : undefined;
}

/**
 * Persist a language choice to the REAL record (when there is one) so it
 * survives the session. The caller is still responsible for switching the UI —
 * that stays in the i18n provider.
 */
export function writePreferredLanguage(
  lang: PreferredLanguage,
  patientId?: string | undefined,
): boolean {
  const id = patientId ?? AdelanteEHR.getCurrentPatientId();
  if (!id || !AdelanteEHR.getPatient(id)) return false;
  AdelanteEHR.updateProfile(id, { preferredLanguage: lang });
  return true;
}

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

/**
 * The id of the member who is actually USING the app right now.
 *
 * `AdelanteEHR.getCurrentPatientId()` is a global "record in focus" value that
 * staff and advocate flows also set, so it is NOT a proxy for "who is signed
 * in". Without this gate, a clinician opening a Spanish-speaking member's
 * chart flipped the whole staff UI to Spanish, and correcting it with the
 * header toggle rewrote that member's stored language — the field that now
 * drives their crisis/988 copy.
 */
export function actingMemberId(): string | undefined {
  try {
    const session =
      window.localStorage.getItem("adelante.session") ??
      window.sessionStorage.getItem("adelante.session");
    if (!session) return undefined;
  } catch {
    return undefined;
  }
  return AdelanteEHR.getCurrentPatientId() || undefined;
}

/** The language on file for the acting member, if there is one. */
export function storedPreferredLanguage(
  patientId?: string | undefined,
): PreferredLanguage | undefined {
  const id = patientId ?? actingMemberId();
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
  // Never write to a record just because it is open on screen: only an
  // explicit `patientId` (the member editing their own profile) or a real
  // signed-in member session may change the stored language.
  const id = patientId ?? actingMemberId();
  if (!id || !AdelanteEHR.getPatient(id)) return false;
  AdelanteEHR.updateProfile(id, { preferredLanguage: lang });
  return true;
}

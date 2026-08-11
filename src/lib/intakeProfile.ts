/**
 * §Intake "About you" pre-fill.
 *
 * Intake used to seed its profile state from the patient row in one effect and
 * then rehydrate a localStorage draft in a *second* effect that spread the
 * saved object wholesale — so an empty saved field clobbered a value the
 * record already had (e.g. a phone captured at `/start/signup`). These two
 * pure helpers make the precedence explicit and testable:
 *
 *   saved draft (only where the user actually typed something)
 *     > patient record
 *     > blank
 *
 * Nothing here locks a field: every value is a normal editable default.
 */
import type {
  BestTime,
  ContactChannel,
  EmergencyContact,
  Patient,
  PreferredLanguage,
} from "@/lib/ehr";
import { emptyEmergencyContact, readEmergencyContacts } from "@/lib/emergencyContacts";

export interface IntakeProfile {
  preferredName: string;
  pronouns: string;
  preferredLanguage: PreferredLanguage;
  phone: string;
  contactChannel: ContactChannel;
  bestTime: BestTime;
  emergencyContacts: EmergencyContact[];
  address: string;
  releaseDate: string;
}

export function blankIntakeProfile(): IntakeProfile {
  return {
    preferredName: "",
    pronouns: "",
    preferredLanguage: "en",
    phone: "",
    contactChannel: "text",
    bestTime: "morning",
    emergencyContacts: [emptyEmergencyContact()],
    address: "",
    releaseDate: "",
  };
}

/**
 * Everything the record already knows, as editable defaults. A genuinely empty
 * field stays empty — no placeholder that reads like real data.
 */
export function seedIntakeProfile(patient: Patient | undefined | null): IntakeProfile {
  const base = blankIntakeProfile();
  if (!patient) return base;
  const contacts = readEmergencyContacts(patient);
  return {
    ...base,
    // Signup captures a legal first name; intake asks what to call you. Using
    // the first name as the default is a reasonable answer to that question.
    preferredName: patient.preferredName || patient.firstName || "",
    pronouns: patient.pronouns || "",
    preferredLanguage: patient.preferredLanguage ?? base.preferredLanguage,
    phone: patient.phone || "",
    contactChannel: patient.contactPrefs?.channel ?? base.contactChannel,
    bestTime: patient.contactPrefs?.bestTime ?? base.bestTime,
    emergencyContacts: contacts.length ? contacts : base.emergencyContacts,
    address: patient.address || "",
    releaseDate: patient.releaseDate || "",
  };
}

const isMeaningful = (v: unknown): boolean =>
  typeof v === "string" ? v.trim().length > 0 : v != null;

/** Overlay a saved draft, ignoring blanks so they can't erase known data. */
export function mergeSavedIntakeProfile(
  seed: IntakeProfile,
  saved: Partial<IntakeProfile> | null | undefined,
): IntakeProfile {
  if (!saved) return seed;
  const out: IntakeProfile = { ...seed };
  (Object.keys(seed) as (keyof IntakeProfile)[]).forEach((key) => {
    const value = saved[key];
    if (key === "emergencyContacts") {
      const rows = saved.emergencyContacts;
      if (Array.isArray(rows) && rows.some((r) => isMeaningful(r?.name) || isMeaningful(r?.phone))) {
        out.emergencyContacts = rows;
      }
      return;
    }
    if (isMeaningful(value)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[key] = value;
    }
  });
  return out;
}

import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { credentialMeta, validateSignup, type SignupInput } from "@/lib/signup";
import { cleanEmergencyContacts, readEmergencyContacts } from "@/lib/emergencyContacts";

const draft = (over: Partial<SignupInput> = {}): SignupInput => ({
  firstName: "Rosa",
  lastName: "Marin",
  dob: "1990-04-02",
  phone: "+1 555 555 0123",
  email: "",
  preferredLanguage: "en",
  credentialKind: "password",
  credential: "supersecret1",
  credentialConfirm: "supersecret1",
  ...over,
});

describe("self-service sign-up validation", () => {
  it("accepts a complete draft", () => {
    expect(validateSignup(draft())).toEqual({});
  });

  it("requires a name, a valid dob, and some way to reach the person", () => {
    expect(validateSignup(draft({ firstName: " " })).firstName).toBeTruthy();
    expect(validateSignup(draft({ dob: "" })).dob).toBeTruthy();
    expect(validateSignup(draft({ dob: "3000-01-01" })).dob).toBeTruthy();
    expect(validateSignup(draft({ phone: "", email: "" })).phone).toBeTruthy();
    expect(validateSignup(draft({ phone: "", email: "not-an-email" })).email).toBeTruthy();
    expect(validateSignup(draft({ phone: "", email: "rosa@example.com" }))).toEqual({});
  });

  it("enforces credential shape and confirmation", () => {
    expect(validateSignup(draft({ credential: "short", credentialConfirm: "short" })).credential)
      .toBeTruthy();
    expect(
      validateSignup(draft({ credentialKind: "pin", credential: "12", credentialConfirm: "12" }))
        .credential,
    ).toBeTruthy();
    expect(
      validateSignup(draft({ credentialKind: "pin", credential: "1234", credentialConfirm: "1234" })),
    ).toEqual({});
    expect(validateSignup(draft({ credentialConfirm: "different1" })).credentialConfirm)
      .toBeTruthy();
  });

  it("never carries the secret into stored metadata (prototype-only credential)", () => {
    const meta = credentialMeta("password");
    expect(meta.verificationAvailable).toBe(false);
    expect(JSON.stringify(meta)).not.toContain("supersecret1");
    expect(Object.keys(meta).sort()).toEqual(["kind", "setAt", "verificationAvailable"]);
  });
});

describe("sign-up creates a real patient record", () => {
  it("persists the captured fields and the credential marker", () => {
    const created = AdelanteEHR.createPatient({
      firstName: "Rosa",
      lastName: "Marin",
      dob: "1990-04-02",
      phone: "+1 555 555 0123",
      email: "rosa@example.com",
      preferredLanguage: "es",
      signupCredential: credentialMeta("pin"),
    });
    const p = AdelanteEHR.getPatient(created.id)!;
    expect(p.programId).toMatch(/^ADL-/);
    expect(p.dob).toBe("1990-04-02");
    expect(p.email).toBe("rosa@example.com");
    expect(p.preferredLanguage).toBe("es");
    expect(p.signupCredential?.kind).toBe("pin");
    expect(p.intakeCompletedAt).toBeUndefined();
  });

  it("leaves staff-provisioned (Track A) records with no signup credential", () => {
    // Same call shape the CF Care Manager caseload upload uses — no credential.
    const p = AdelanteEHR.createPatient({ firstName: "Track", lastName: "A" });
    expect(p.signupCredential).toBeUndefined();
  });
});

describe("multiple emergency contacts", () => {
  it("adds, persists every new field, and keeps the legacy primary in sync", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Multi", lastName: "Contact" });
    AdelanteEHR.updateProfile(p.id, {
      emergencyContacts: cleanEmergencyContacts([
        {
          name: "  Ana Marin  ",
          relationship: "sister",
          phone: "555-0100",
          email: "ana@example.com",
          address: "12 Oak St, Visalia",
          notes: "Call after 6pm",
        },
        { name: "Luis P", relationship: "friend", phone: "555-0111" },
        { name: "   ", relationship: "", phone: "" },
      ]),
    });
    const saved = AdelanteEHR.getPatient(p.id)!;
    expect(saved.emergencyContacts).toHaveLength(2); // blank row dropped
    expect(saved.emergencyContacts?.[0]).toMatchObject({
      name: "Ana Marin",
      email: "ana@example.com",
      address: "12 Oak St, Visalia",
      notes: "Call after 6pm",
    });
    expect(saved.emergencyContact?.name).toBe("Ana Marin");
  });

  it("removes a contact and re-points the legacy primary", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Remove", lastName: "Contact" });
    AdelanteEHR.updateProfile(p.id, {
      emergencyContacts: [
        { name: "First", relationship: "aunt", phone: "1" },
        { name: "Second", relationship: "friend", phone: "2" },
      ],
    });
    AdelanteEHR.updateProfile(p.id, {
      emergencyContacts: [{ name: "Second", relationship: "friend", phone: "2" }],
    });
    const saved = AdelanteEHR.getPatient(p.id)!;
    expect(saved.emergencyContacts).toHaveLength(1);
    expect(saved.emergencyContact?.name).toBe("Second");
  });

  it("reads legacy single-contact records as a one-item list", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Legacy", lastName: "Contact" });
    AdelanteEHR.updateProfile(p.id, {
      emergencyContact: { name: "Old Shape", relationship: "cousin", phone: "3" },
    });
    const saved = AdelanteEHR.getPatient(p.id)!;
    expect(readEmergencyContacts(saved).map((c) => c.name)).toEqual(["Old Shape"]);
  });
});

import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { credentialMeta } from "@/lib/signup";
import {
  blankIntakeProfile,
  mergeSavedIntakeProfile,
  seedIntakeProfile,
} from "@/lib/intakeProfile";

describe("intake About-you pre-fill", () => {
  it("pre-fills from a self-service sign-up record", () => {
    const created = AdelanteEHR.createPatient({
      firstName: "Rosa",
      lastName: "Marin",
      dob: "1990-04-02",
      phone: "+1 555 555 0123",
      preferredLanguage: "es",
      signupCredential: credentialMeta("pin"),
    });
    const p = AdelanteEHR.getPatient(created.id)!;
    const seed = seedIntakeProfile(p);
    expect(seed.preferredName).toBe("Rosa");
    expect(seed.phone).toBe("+1 555 555 0123");
    expect(seed.preferredLanguage).toBe("es");
  });

  it("pre-fills staff-entered demographics (code-redemption path)", () => {
    const staffMade = AdelanteEHR.createPatient({
      firstName: "Luis",
      lastName: "Ortiz",
      dob: "1985-01-09",
      phone: "555-0144",
    });
    AdelanteEHR.updateProfile(staffMade.id, { address: "12 Oak St" });
    const seed = seedIntakeProfile(AdelanteEHR.getPatient(staffMade.id)!);
    expect(seed.preferredName).toBe("Luis");
    expect(seed.phone).toBe("555-0144");
    expect(seed.address).toBe("12 Oak St");
  });

  it("leaves genuinely missing fields blank rather than faking data", () => {
    const bare = AdelanteEHR.createPatient({ firstName: "Track", lastName: "A" });
    const seed = seedIntakeProfile(AdelanteEHR.getPatient(bare.id)!);
    expect(seed.phone).toBe("");
    expect(seed.address).toBe("");
    expect(seed.releaseDate).toBe("");
    expect(seedIntakeProfile(undefined)).toEqual(blankIntakeProfile());
  });

  it("keeps a real edit from the saved draft but never lets a blank erase record data", () => {
    const p = AdelanteEHR.getPatient(
      AdelanteEHR.createPatient({ firstName: "Ana", lastName: "R", phone: "555-0100" }).id,
    )!;
    const seed = seedIntakeProfile(p);
    const merged = mergeSavedIntakeProfile(seed, {
      preferredName: "Anita", // user corrected it — wins
      phone: "", // stale blank draft — must not wipe the record's phone
      address: "9 Pine",
    });
    expect(merged.preferredName).toBe("Anita");
    expect(merged.phone).toBe("555-0100");
    expect(merged.address).toBe("9 Pine");
  });

  it("persists a correction back to the record", () => {
    const p = AdelanteEHR.createPatient({ firstName: "Edit", lastName: "R", phone: "555-0000" });
    AdelanteEHR.updateProfile(p.id, { phone: "555-9999", preferredName: "Eddie" });
    const after = AdelanteEHR.getPatient(p.id)!;
    expect(after.phone).toBe("555-9999");
    expect(seedIntakeProfile(after).preferredName).toBe("Eddie");
  });
});

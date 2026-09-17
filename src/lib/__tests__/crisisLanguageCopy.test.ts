import { describe, expect, it } from "vitest";
import { crisisMatchLanguage, detectCrisisLanguage } from "@/lib/crisisTextDetection";
import { crisisCopy } from "@/lib/crisisCopy";
import { AdelanteEHR } from "@/lib/ehr";
import { writePreferredLanguage, storedPreferredLanguage } from "@/lib/languagePreference";

describe("crisis reply language follows the match, not the account", () => {
  it("a Spanish match yields Spanish canned copy", () => {
    const hit = detectCrisisLanguage("ya no quiero estar aqui");
    expect(hit.matched).toBe(true);
    expect(crisisMatchLanguage(hit.patternIds)).toBe("es");
    const copy = crisisCopy("es");
    expect(copy.adelReply).toContain("988");
    expect(copy.adelReply).toMatch(/Llama o env/i);
    expect(copy.careTeamAlerted).toMatch(/equipo de cuidado/i);
  });

  it("an English match still yields English canned copy", () => {
    const hit = detectCrisisLanguage("I want to kill myself");
    expect(crisisMatchLanguage(hit.patternIds)).toBe("en");
    expect(crisisCopy("en").adelReply).toMatch(/Call or text 988/);
  });

  it("mixed and empty matches resolve predictably", () => {
    expect(crisisMatchLanguage(["kill_myself", "es_cortarme"])).toBe("es");
    expect(crisisMatchLanguage([])).toBe("en");
  });

  it("every Spanish string is actually different from the English one", () => {
    const en = crisisCopy("en");
    const es = crisisCopy("es");
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(es[k], k).not.toBe(en[k]);
      expect(es[k].length, k).toBeGreaterThan(2);
    }
  });
});

describe("preferredLanguage is a real, readable/writable source of truth", () => {
  it("writes and reads back the same record field", () => {
    const id = AdelanteEHR.createPatient({ firstName: "Lang", lastName: "Sync" } as never).id;
    expect(storedPreferredLanguage(id)).toBeUndefined();
    expect(writePreferredLanguage("es", id)).toBe(true);
    expect(AdelanteEHR.getPatient(id)?.preferredLanguage).toBe("es");
    expect(storedPreferredLanguage(id)).toBe("es");
    writePreferredLanguage("en", id);
    expect(storedPreferredLanguage(id)).toBe("en");
  });

  it("is a safe no-op when there is no record to write to", () => {
    expect(writePreferredLanguage("es", "not-a-real-patient")).toBe(false);
  });
});

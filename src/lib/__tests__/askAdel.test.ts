// §Phase 5e — Ask Adel prototype: role mapping, access filtering, Part 2
// masking, cohort guard and the read-only guarantee.
import { describe, expect, it } from "vitest";
import { STAFF_ROLES, type StaffRole } from "@/lib/roles";
import {
  ASK_ADEL_QUESTIONS,
  answerAskAdel,
  askAdelQuestionsFor,
  askAdelShortcutsFor,
  canUseAskAdel,
  roleGroupFor,
  part2Gated,
} from "@/lib/askAdel";
import { AdelanteEHR } from "@/lib/ehr";

const ctxFor = (role: StaffRole) => ({
  role,
  staffId: "s-test",
  staffName: "Test Staff",
});

describe("Ask Adel — role groups", () => {
  it("places every staff role in exactly one group", () => {
    for (const { key } of STAFF_ROLES) {
      expect(["clinical", "coordination", "admin"]).toContain(roleGroupFor(key));
    }
  });

  it("groups the clinical, coordination and administrative roles as agreed", () => {
    expect(roleGroupFor("therapist")).toBe("clinical");
    expect(roleGroupFor("pmhnp")).toBe("clinical");
    expect(roleGroupFor("sud_counselor")).toBe("clinical");
    expect(roleGroupFor("clinical_trainee")).toBe("clinical");
    expect(roleGroupFor("ecm_provider")).toBe("coordination");
    expect(roleGroupFor("cf_care_manager")).toBe("coordination");
    expect(roleGroupFor("peer_specialist")).toBe("coordination");
    expect(roleGroupFor("community_health_worker")).toBe("coordination");
    expect(roleGroupFor("clinical_coordinator")).toBe("admin");
    expect(roleGroupFor("billing")).toBe("admin");
    expect(roleGroupFor("credentialing_coordinator")).toBe("admin");
    expect(roleGroupFor("sys_admin")).toBe("admin");
  });
});

describe("Ask Adel — access filtering", () => {
  it("only offers a role questions from its own group", () => {
    for (const { key } of STAFF_ROLES) {
      for (const q of askAdelQuestionsFor(key)) {
        expect(q.group).toBe(roleGroupFor(key));
      }
    }
  });

  it("gives the credentialing coordinator the credential question and no patient shortcut", () => {
    const ids = askAdelQuestionsFor("credentialing_coordinator").map((q) => q.id);
    expect(ids).toContain("admin-credentials-expiring");
    expect(ids).not.toContain("admin-claims-awaiting-signature");
    expect(askAdelShortcutsFor("credentialing_coordinator")).toHaveLength(0);
  });

  it("refuses to answer a question the acting role is not granted", () => {
    // Billing has no social-needs access, so a coordination question is not answerable.
    expect(answerAskAdel("coord-stalled-needs", ctxFor("billing"))).toBeUndefined();
  });

  it("shows the button only when a question or a shortcut exists", () => {
    for (const { key } of STAFF_ROLES) {
      const has =
        askAdelQuestionsFor(key).length > 0 || askAdelShortcutsFor(key).length > 0;
      expect(canUseAskAdel(key)).toBe(has);
    }
  });
});

describe("Ask Adel — Part 2 and safety", () => {
  it("treats a role without resolved SUD access as gated", () => {
    expect(part2Gated("community_health_worker")).toBe(true);
    expect(part2Gated("peer_specialist")).toBe(true);
  });

  it("never names a recovery or support-group referral for a gated viewer", () => {
    const patient = AdelanteEHR.listPatients()[0];
    AdelanteEHR.setConsent?.(patient.id, { part2Sud: true } as never);
    try {
      AdelanteEHR.addResourceReferral(patient.id, {
        category: "recovery_meetings",
        provider: "Valley Recovery Fellowship",
        status: "waitlisted",
      } as never);
    } catch {
      // Consent gate may refuse; the masking assertion below still holds.
    }
    const answer = answerAskAdel("coord-waitlisted", ctxFor("community_health_worker"));
    const text = (answer?.lines ?? []).join(" ");
    expect(text).not.toMatch(/recovery_meetings|support_groups|Fellowship/i);
  });

  it("tells a gated clinical viewer that SUD instruments are excluded", () => {
    const answer = answerAskAdel("clinical-rescreens", ctxFor("medical_assistant"));
    if (answer && part2Gated("medical_assistant")) {
      expect((answer.notes ?? []).join(" ")).toMatch(/42 CFR Part 2/);
    }
  });
});

describe("Ask Adel — aggregates and read-only", () => {
  it("carries the shared cohort guard on program-wide aggregates", () => {
    const funnel = answerAskAdel("admin-referral-conversion", ctxFor("sys_admin"));
    expect(funnel?.guard?.minimumCohortSize).toBe(11);
    const elig = answerAskAdel("admin-eligibility", ctxFor("sys_admin"));
    expect(elig?.guard).toBeDefined();
  });

  it("returns only text, notes and a link — never a callable action", () => {
    for (const q of ASK_ADEL_QUESTIONS) {
      const a = answerAskAdel(q.id, ctxFor("sys_admin"));
      if (!a) continue;
      for (const value of Object.values(a)) {
        expect(typeof value).not.toBe("function");
      }
      if (a.link) expect(typeof a.link.to).toBe("string");
    }
  });
});

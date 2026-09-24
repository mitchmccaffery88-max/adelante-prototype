// §Referrals Rework Phase 4e — real outreach work, attempt trail, fallback.
import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "../ehr";
import {
  OUTREACH_FALLBACK_DRAFT,
  hasOpenOutreachTask,
  needsReferrerFallback,
  referralNeedsOutreachTask,
} from "../referralOutreach";

const base = {
  firstName: "Test",
  lastName: "Person",
  referringAgency: "County Probation",
  referrerName: "Officer Diaz",
  referrerPhone: "5105551212",
  referrerEmail: "diaz@county.gov",
  referralSource: "probation" as const,
};

describe("outreach task creation", () => {
  it("creates a real open task when no phone is given", () => {
    const r = AdelanteEHR.createReferral({ ...base, consentToContact: false });
    expect(r.outreach?.task?.status).toBe("open");
    expect(r.outreach?.task?.reason).toBe("no_phone");
    expect(r.outreach?.task?.dueDate).toBeTruthy();
    expect(r.outreach?.task?.allowedRoles.length).toBeGreaterThan(0);
    expect(hasOpenOutreachTask(r)).toBe(true);
  });

  it("creates a task when a phone exists but consent was not given", () => {
    const r = AdelanteEHR.createReferral({ ...base, phone: "5105550000", consentToContact: false });
    expect(r.outreach?.task?.reason).toBe("no_consent");
  });

  it("creates no task when a welcome text can genuinely be attempted", () => {
    const r = AdelanteEHR.createReferral({ ...base, phone: "5105550000", consentToContact: true });
    expect(r.outreach).toBeUndefined();
    expect(hasOpenOutreachTask(r)).toBe(false);
  });

  it("maps the reason purely", () => {
    expect(referralNeedsOutreachTask({ consentToContact: true })).toBe("no_phone");
    expect(referralNeedsOutreachTask({ phone: "1", consentToContact: false })).toBe("no_consent");
    expect(referralNeedsOutreachTask({ phone: "1", consentToContact: true })).toBeUndefined();
  });
});

describe("attempt logging", () => {
  it("records outcome, note and attribution", () => {
    const r = AdelanteEHR.createReferral({ ...base, consentToContact: false });
    AdelanteEHR.logReferralOutreachAttempt(r.id, { outcome: "no_answer", note: "rang out" });
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    const a = after.outreach!.attempts[0]!;
    expect(a.outcome).toBe("no_answer");
    expect(a.note).toBe("rang out");
    expect(a.by.name).toBeTruthy();
  });

  it("a reached attempt closes the task and marks the referral contacted", () => {
    const r = AdelanteEHR.createReferral({ ...base, consentToContact: false });
    AdelanteEHR.logReferralOutreachAttempt(r.id, { outcome: "reached" });
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(after.outreach!.task!.status).toBe("done");
    expect(after.status).toBe("contacted");
    expect(after.contactedBy?.name).toBeTruthy();
  });

  it("claiming records the owner", () => {
    const r = AdelanteEHR.createReferral({ ...base, consentToContact: false });
    AdelanteEHR.claimReferralOutreach(r.id);
    const after = AdelanteEHR.listReferrals().find((x) => x.id === r.id)!;
    expect(after.outreach!.task!.claimedBy?.staffId).toBeTruthy();
  });
});

describe("referrer fallback trigger", () => {
  it("fires immediately when no phone was ever given", () => {
    const f = needsReferrerFallback({ referrerPhone: "5105551212", status: "submitted" });
    expect(f.due).toBe(true);
    expect(f.reason).toBe("no_phone");
  });

  it("fires immediately on a dead number", () => {
    const f = needsReferrerFallback({ referrerPhone: "5105551212",
      status: "submitted",
      phone: "5105550000",
      outreach: {
        attempts: [
          {
            id: "a",
            at: new Date().toISOString(),
            outcome: "wrong_number",
            by: { staffId: "s", name: "S", role: "ecm_provider" },
          },
        ],
      },
    });
    expect(f.due).toBe(true);
    expect(f.reason).toBe("dead_number");
  });

  it("waits for the draft unanswered threshold", () => {
    const attempt = (id: string) => ({
      id,
      at: new Date().toISOString(),
      outcome: "no_answer" as const,
      by: { staffId: "s", name: "S", role: "ecm_provider" },
    });
    const one = needsReferrerFallback({ referrerPhone: "5105551212",
      status: "submitted",
      phone: "5105550000",
      outreach: { attempts: [attempt("a")] },
    });
    expect(one.due).toBe(false);
    const two = needsReferrerFallback({ referrerPhone: "5105551212",
      status: "submitted",
      phone: "5105550000",
      outreach: { attempts: [attempt("a"), attempt("b")] },
    });
    expect(two.due).toBe(true);
    expect(OUTREACH_FALLBACK_DRAFT.unansweredAttempts).toBe(2);
  });

  it("never fires once the person was reached or the referral closed", () => {
    expect(
      needsReferrerFallback({ referrerPhone: "5105551212",
        status: "submitted",
        outreach: {
          attempts: [
            {
              id: "a",
              at: new Date().toISOString(),
              outcome: "reached",
              by: { staffId: "s", name: "S", role: "ecm_provider" },
            },
          ],
        },
      }).due,
    ).toBe(false);
    expect(needsReferrerFallback({ status: "enrolled" }).due).toBe(false);
    expect(needsReferrerFallback({ status: "declined" }).due).toBe(false);
  });
});

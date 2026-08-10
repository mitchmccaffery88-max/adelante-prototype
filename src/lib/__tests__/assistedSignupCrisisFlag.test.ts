import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { ASSISTED_SIGNUP_CRISIS_DETAIL } from "@/components/clinical/AssistedSignupCrisisButton";

function newPatient() {
  return AdelanteEHR.createPatient({
    firstName: "Signup",
    lastName: "Helper",
    programId: "TEST",
  } as never).id;
}

describe("assisted sign-up crisis flag (stopgap)", () => {
  it("creates a real, correctly-routed crisis queue entry", () => {
    const pid = newPatient();
    const row = AdelanteEHR.flagCrisis(pid, "Nurse Ada", ASSISTED_SIGNUP_CRISIS_DETAIL, {
      triggerSource: "assisted_signup",
    });
    expect(row.status).toBe("open");
    expect(row.triggeredBy).toBe("Nurse Ada");
    expect(row.triggeredAt).toBeTruthy();
    const alert = AdelanteEHR.listAlerts(pid).find((a) => a.id === row.alertId);
    expect(alert?.severity).toBe("critical");
    expect(alert?.active).toBe(true);
    expect(alert?.label).toBe(AdelanteEHR.CRISIS_ALERT_LABEL);
    expect(AdelanteEHR.listOpenCrisisEscalations().some((r) => r.escalation.id === row.id)).toBe(
      true,
    );
  });

  it("is distinguishable from screener-triggered and chart-manual flags", () => {
    const pid = newPatient();
    const signup = AdelanteEHR.flagCrisis(pid, "Nurse Ada", ASSISTED_SIGNUP_CRISIS_DETAIL, {
      triggerSource: "assisted_signup",
    });
    const chart = AdelanteEHR.flagCrisis(pid, "Dr. B", "Disclosed active plan");
    expect(signup.triggerSource).toBe("assisted_signup");
    expect(signup.triggerDetail).toMatch(/sign-up assistance/i);
    expect(chart.triggerSource).toBe("manual");
  });
});
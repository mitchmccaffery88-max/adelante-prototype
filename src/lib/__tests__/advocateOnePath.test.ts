// §F1 — one advocate consent path: the versioned advocate_patient form.
import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { AdelanteEHR } from "@/lib/ehr";
import * as deliveryFunctions from "@/lib/advocateInvite.functions";
import { advocateConsentFormStatus, setChecked, signChecked, formsToSign } from "@/lib/consentForms";
import { advocateInvitationConsentActive } from "@/lib/advocateInviteDelivery";

describe("F1 one advocate consent path", () => {
  it("the old typed-name card and helper are gone; nothing imports them", () => {
    expect(existsSync("src/components/consent/AdvocateConsentCard.tsx")).toBe(false);
    expect(existsSync("src/lib/advocateConsentSign.ts")).toBe(false);
    const hits = execSync("grep -rlE 'AdvocateConsentCard|signAdvocateConsent|advocateConsentSign' src --include=*.tsx --include=*.ts || true").toString().trim().split("\n").filter((f) => f && !f.includes("__tests__"));
    expect(hits).toEqual([]);
    for (const f of ["src/routes/consent.tsx", "src/components/PatientHome.tsx", "src/components/patient/ProfilePanels.tsx"]) expect(readFileSync(f, "utf8")).toContain("<AdvocateConsentStatus");
    expect(readFileSync("src/components/advocate/AdvocateSection.tsx", "utf8")).not.toContain("advocate-sign-name");
  });

  it("invitation waits for the form; signing it writes roi_collateral and delivers the invite", async () => {
    const send = vi.spyOn(deliveryFunctions, "sendAdvocateInvite").mockResolvedValue({ status: "sent", detail: "Sent to test." });
    const p = AdelanteEHR.createPatient({ firstName: "Onepath", lastName: "Tester", dob: "1990-01-02", phone: "5595550301" } as never);
    const link = AdelanteEHR.createAdvocateInvitation({ patientId: p.id, advocateName: "Ana Tester", invitationSentTo: "5595550302", invitationChannel: "sms", expectedAuthorizationType: "family_participation", designatedBy: { actor: "patient", name: "Onepath Tester" } });
    expect(advocateConsentFormStatus(p.id)).toBe("waiting");
    expect(formsToSign(p.id).items.some((i) => i.request.formKey === "advocate_patient")).toBe(true);
    expect(advocateInvitationConsentActive(p.id)).toBe(false);
    expect(send).not.toHaveBeenCalled();
    setChecked(p.id, "advocate_patient", true);
    signChecked({ patientId: p.id, signerName: "Onepath Tester", typedName: "Onepath Tester" });
    expect(advocateConsentFormStatus(p.id)).toBe("signed");
    expect(AdelanteEHR.activeConsentRecord(p.id)!.sections.some((s) => s.category === "roi_collateral" && s.authorized)).toBe(true);
    await vi.waitFor(() => expect(AdelanteEHR.getAdvocateLink(link.id)!.notificationSentAt).toBeTruthy());
    expect(send).toHaveBeenCalledTimes(1);
    send.mockRestore();
  });
});

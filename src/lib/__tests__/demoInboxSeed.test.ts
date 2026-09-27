import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import "@/lib/demoInboxSeed";
import { canAccess } from "@/lib/roles";

describe("demo inbox seed — real store functions", () => {
  it("fills the crisis queue across trigger sources and lanes", () => {
    const open = AdelanteEHR.listOpenCrisisEscalations();
    const sources = new Set(open.map((r) => r.escalation.triggerSource));
    for (const s of ["screener_score", "message_pattern", "manual", "patient_request"]) expect(sources.has(s as never)).toBe(true);
    expect(open.some((r) => r.escalation.category === "sdoh")).toBe(true);
    expect(AdelanteEHR.listAnonymousCrisisAlerts().length).toBeGreaterThan(0);
    const resolved = AdelanteEHR.listPatients().flatMap((p) => p.crisisEscalations ?? []).filter((e) => e.status === "resolved");
    expect(resolved.some((e) => e.disposition)).toBe(true);
  });
  it("no seeded crisis item is substance-use related", () => {
    for (const r of AdelanteEHR.listOpenCrisisEscalations()) expect(r.escalation.triggerDetail).not.toMatch(/substance|alcohol|drug|asam|sud/i);
  });
  it("every staff bell has something, mostly unread; billing sees only the generic DMC-ODS reason", () => {
    for (const [name, role, id] of [["Anita Brooks", "therapist", "s-th3"], ["Luz Herrera", "ecm_provider", "s-cm1"], ["Tonya Price", "billing", "s-bill1"], ["Priya Raman", "clinical_coordinator", "s-cc1"], ["Dr. R. Bagga", "pmhnp", "s-np1"], ["Renee Castillo", "sud_counselor", "s-sudc1"]] as const) {
      const rows = AdelanteEHR.listNotificationsFor(name, role, id);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.filter((n) => !n.readAt).length).toBeGreaterThan(0);
    }
    const billing = AdelanteEHR.listNotificationsFor("Tonya Price", "billing").filter((n) => n.subject.includes("DMC-ODS"));
    expect(billing.every((n) => n.body.startsWith("Blocked: clinical documentation incomplete"))).toBe(true);
    const asam = AdelanteEHR.listNotifications().filter((n) => n.category === "asam_task");
    expect(asam.every((n) => !/substance|alcohol|drug|asam/i.test(n.subject + n.body))).toBe(true);
    expect(canAccess).toBeTruthy();
  });
  it("seeds unread patient threads and extra provider requests", () => {
    expect(AdelanteEHR.listUnreadMessageThreads().length).toBeGreaterThanOrEqual(4);
    expect(AdelanteEHR.listProviderRequests().length).toBeGreaterThanOrEqual(5);
  });
});

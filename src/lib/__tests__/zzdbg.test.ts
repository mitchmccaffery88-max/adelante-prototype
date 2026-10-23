import { it, vi } from "vitest";
vi.hoisted(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T12:00:00.000Z")); });
import { AdelanteEHR } from "@/lib/ehr";
import { buildBillingLifecycleScenario } from "@/lib/billingLifecycleScenario";
it("dbg", () => {
  const a = AdelanteEHR.listAuditEvents({ category: "consent" }).map(e => [e.action, e.patientId, (e.detail as any)?.consentEvent, (e.detail as any)?.consentType]);
  buildBillingLifecycleScenario();
  const b = AdelanteEHR.listAuditEvents({ category: "consent" }).map(e => [e.action, e.patientId, (e.detail as any)?.consentEvent, (e.detail as any)?.consentType]);
  require("node:fs").writeFileSync("/tmp/b25dbg/cev.json", JSON.stringify({ a, b }));
});

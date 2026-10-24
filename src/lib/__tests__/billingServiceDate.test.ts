// Friday cleanup (Mitch, Oct 23) — standalone-claim service-date bug.
// Claims without a matching appointment (group / peer / CHW / ASAM) showed the
// claim's first history timestamp instead of the stored serviceDate, and a
// bare YYYY-MM-DD rendered a day early west of UTC.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";

const src = readFileSync("src/routes/billing.tsx", "utf8");

describe("standalone-claim service date", () => {
  it("standalone rows prefer the stored serviceDate over history/update timestamps", () => {
    expect(src).toContain("date: c.serviceDate ?? c.history[0]?.at ?? c.updatedAt,");
  });

  it("date-only values render as calendar dates, not UTC-shifted timestamps", () => {
    expect(src).toContain('new Date(/^\\d{4}-\\d{2}-\\d{2}$/.test(date) ? `${date}T00:00:00` : date).toLocaleDateString()');
    // The guard itself: a bare date must not move a day in US timezones.
    const date = "2026-09-01";
    const rendered = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date);
    expect(rendered.getDate()).toBe(1);
  });

  it("the stored claim keeps the service date it was created with", () => {
    const p = AdelanteEHR.listPatients()[0];
    const clin = AdelanteEHR.listClinicians()[0];
    const claim = AdelanteEHRExt.createAsamClaim({
      asamId: `fri-date-${Date.now()}`,
      patientId: p.id,
      clinicianId: clin.id,
      serviceDate: "2026-09-01",
    });
    expect(claim.serviceDate).toBe("2026-09-01");
  });
});

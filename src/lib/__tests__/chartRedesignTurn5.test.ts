import { describe, expect, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import "@/lib/demoInboxSeed";
import {
  acceptNoteDraft,
  buildNoteDraft,
  buildOutreachDraft,
  buildRefillSummary,
  sendOutreach,
  canSendOutreach,
} from "@/lib/adelDrafts";

const byName = (n: string) => AdelanteEHR.listPatients().find((p) => p.firstName === n)!;
const SUD = /buprenorph|naloxone|substance|opioid|alcohol|suboxone|methadone|naltrexone|asam|uds|drug screen/i;

describe("Draft with Adel (turn 5)", () => {
  it("note draft pre-fills sections and accept creates an unsigned ai_draft note, audited", () => {
    const luis = byName("Luis");
    const d = buildNoteDraft(luis, "physician");
    expect(d.subjective).toMatch(/Visit reason/);
    expect(d.assessment).toMatch(/C-SSRS|risk/);
    const before = (luis.progressNotes ?? []).length;
    const n = acceptNoteDraft({ patientId: luis.id, draft: d, original: d, actor: { name: "Dr. M. Bagga", role: "physician" } });
    expect(n?.authorSource).toBe("ai_draft");
    expect(n?.status).toBe("draft");
    expect((AdelanteEHR.getPatient(luis.id)!.progressNotes ?? []).length).toBe(before + 1);
    expect(AdelanteEHR.listAuditEvents({ patientId: luis.id }).some((e) => e.action === "adel_draft_accepted")).toBe(true);
  });

  it("note draft for a restricted role has no SUD content", () => {
    const luis = byName("Luis");
    const d = buildNoteDraft(luis, "ecm_provider");
    expect(Object.values(d).join(" ")).not.toMatch(SUD);
  });

  it("refill summary lists safety context and flags CURES for controlled meds", () => {
    const r = AdelanteEHR.listRefillRequests({ status: "pending" }).find((x) => /bupren/i.test(x.medicationName))!;
    const s = buildRefillSummary(r, "physician");
    expect(s.controlled).toBe(true);
    expect(s.lines.map((l) => l.label)).toEqual(expect.arrayContaining(["Last fill", "Adherence", "Side effects", "CURES", "Last visit", "Relevant labs"]));
    expect(["approve", "approve_with_visit", "deny"]).toContain(s.suggestion);
  });

  it("outreach drafts are plain, bilingual and Part 2-safe; send is role-checked and audited", () => {
    const luis = byName("Luis");
    const en = buildOutreachDraft(luis, "missed_visit", "en", "Luz Herrera");
    const es = buildOutreachDraft(luis, "missed_visit", "es", "Luz Herrera");
    expect(en).toMatch(/missed you/);
    expect(es).toMatch(/cita/);
    expect(en + es).not.toMatch(SUD);
    expect(canSendOutreach("billing", luis)).toBe(false);
    expect(() => sendOutreach({ patientId: luis.id, text: en, original: en, reason: "missed_visit", lang: "en", actor: { name: "B", role: "billing" } })).toThrow();
  });
});

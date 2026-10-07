import { describe, expect, it, vi } from "vitest";
let LANG: "en" | "es" = "en";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: LANG }) }));
vi.mock("@tanstack/react-router", async (orig) => ({ ...(await orig<object>()), Link: ({ children }: { children: unknown }) => children }));
import { renderToStaticMarkup } from "react-dom/server";
import { AdelanteEHR, demoScenarioPatientId } from "@/lib/ehr";
import { ASAM_DIMENSIONS } from "@/lib/asam";
import { signAsamAssessment } from "@/lib/asamFlow";
import { acceptAsamSuggestion, latestFinalAsam, listAsamSuggestions } from "@/lib/asamCarePlan";
import { MyPlan } from "@/components/careplan/MyPlan";

const BAGGA = { staffId: "s-np1", name: "Dr. M. Bagga", role: "physician" as const, clinicianId: "c5" };

describe("C2 — patient My plan shows accepted ASAM goals in plain language, no codes (EN/ES)", () => {
  it("renders goal + what I'll do steps, never dimension codes or jargon", () => {
    const p = AdelanteEHR.getPatient(demoScenarioPatientId("sud_consented")!)!;
    const v = AdelanteEHR.amendAsam(p.id, latestFinalAsam(p)!.id, BAGGA, "Reassessment");
    AdelanteEHR.saveAsamDraft(p.id, { dimensions: ASAM_DIMENSIONS.map((d) => ({ key: d.key, documentation: "Doc.", rating: d.key === "d5" || d.key === "d6" ? 3 : 1 })), actualLevel: "intensive_outpatient", recommendedLevel: "intensive_outpatient" }, BAGGA);
    signAsamAssessment(p.id, v.id, BAGGA, { attested: true, signatureDataUrl: "data:image/png;base64,c2VlZA==" });
    for (const s of listAsamSuggestions(p.id, "physician")) acceptAsamSuggestion(p.id, s.id, { name: BAGGA.name, role: "physician", staffId: BAGGA.staffId });
    const FORBIDDEN = /ASAM|Dimension|\bd[1-6]\b|rating|F1\d|Z\d\d|ICD|DMC|level of care|relapse-prevention/i;
    for (const lang of ["en", "es"] as const) {
      LANG = lang;
      const html = renderToStaticMarkup(<MyPlan patientId={p.id} />);
      expect(html, lang).toContain(lang === "en" ? "Have a plan for hard days." : "Tener un plan para los días difíciles.");
      expect(html, lang).toContain(lang === "en" ? "What I&#x27;ll do" : "Lo que voy a hacer");
      expect(html.replace(/<[^>]+>/g, " "), lang).not.toMatch(FORBIDDEN);
      if (lang === "es") expect(html).toContain("Borrador");
    }
  });
});

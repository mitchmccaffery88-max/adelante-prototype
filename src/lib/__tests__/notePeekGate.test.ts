import { describe, it, expect } from "vitest";
import { AdelanteEHR, type ProgressNote } from "@/lib/ehr";
import { noteVisibleToRole } from "@/components/agentic/NotePeekSheet";

describe("Chart Review note peek gate", () => {
  const luis = AdelanteEHR.listPatients().find((p) => p.firstName === "Luis")!;
  const base = (luis.progressNotes ?? [])[0] ?? ({ id: "x", clinicianId: "c1", date: "2026-01-01", sessionType: "individual", subjective: "", objective: "", assessment: "", plan: "" } as ProgressNote);
  it("therapist can open an ordinary note", () => {
    expect(noteVisibleToRole("therapist", luis, { ...base, category: undefined }).visible).toBe(true);
  });
  it("advocate never can", () => {
    expect(noteVisibleToRole("advocate" as never, luis, base).visible).toBe(false);
  });
});

// Quick-actions batch 3 — content-center "+ New" items come only from the
// registry's own allowed(); nurse sign-off actions never surface.
import { describe, expect, it } from "vitest";
import { contentNewItems } from "@/components/admin/ContentNewLauncher";
import { quickActionsFor } from "@/lib/quickActions";

const ids = (role: string) => contentNewItems({ role, staffId: "x" } as never).map((x) => x.action.id);

describe("content center + New items", () => {
  it("clinical coordinator gets create content and consent form authoring", () => {
    expect(ids("clinical_coordinator")).toEqual(["content_create", "consent_form_author"]);
  });
  it("sys_admin gets create content and consent form authoring", () => {
    expect(ids("sys_admin")).toEqual(["content_create", "consent_form_author"]);
  });
  it("therapist can author content but not consent forms", () => {
    expect(ids("therapist")).toEqual(["content_create"]);
  });
  it("medical assistant (read-only content) gets nothing, so no + New", () => {
    expect(ids("medical_assistant")).toEqual([]);
  });
  it("billing gets nothing", () => {
    expect(ids("billing")).toEqual([]);
  });
});

describe("pending sign-off actions", () => {
  it("nurse quick actions never include clinic dose or refill coordination", () => {
    const q = quickActionsFor({ role: "nurse_rn", staffId: "s-n1" } as never).map((a) => a.id);
    expect(q).not.toContain("clinic_dose_give");
    expect(q).not.toContain("refill_coordinate");
  });
});

import { describe, it, expect } from "vitest";
import { resolveChartLocation, orderSectionsForRole } from "../chartTabs";
import { ADEL_REVIEW_LABEL } from "../adelDrafts";
import { canAccess } from "../roles";

const subs = (ids: string[]) => ids.map((id) => ({ id }));
describe("chart turn 4 finish", () => {
  it("new sub-sections resolve to their tabs", () => {
    expect(resolveChartLocation("consents")).toEqual({ tab: "record", sub: "consents" });
    expect(resolveChartLocation("audit-trail")).toEqual({ tab: "record", sub: "audit-trail" });
    expect(resolveChartLocation("weekly-review")).toEqual({ tab: "tasks-contacts", sub: "weekly-review" });
  });
  it("role-based first sub-section", () => {
    const meds = subs(["orders", "labs", "med-recon", "allergies"]);
    expect(orderSectionsForRole("medications", meds, "pmhnp")[0]!.id).toBe("orders");
    expect(orderSectionsForRole("medications", meds, "therapist")[0]!.id).toBe("med-recon");
    const tc = subs(["tasks", "contacts", "weekly-review", "checkins"]);
    expect(orderSectionsForRole("tasks-contacts", tc, "ecm_provider")[0]!.id).toBe("contacts");
    expect(orderSectionsForRole("tasks-contacts", tc, "cf_care_manager")[0]!.id).toBe("contacts");
    expect(orderSectionsForRole("tasks-contacts", tc, "therapist")[0]!.id).toBe("tasks");
  });
  it("audit trail only for audit roles; label wording", () => {
    expect(canAccess("billing", "platform_administration").level).toBe("none");
    expect(canAccess("sys_admin", "platform_administration").level).not.toBe("none");
    expect(ADEL_REVIEW_LABEL).toBe("Draft by Adel — review before saving");
  });
});

// §Phase 7a — billing and billing_coordinator are one billing function until
// the roles are merged. This test fails if they ever drift on any class.
import { describe, expect, it } from "vitest";
import { canAccess, type RecordClass } from "../roles";
import { STAFF_NAV, canSeeNavEntry, staffNavGroupsForRole } from "../navSections";
import { resolveNavAccess } from "../navGuard";
import * as rolesSrc from "../roles?raw";

const CLASSES = Array.from(
  (rolesSrc as unknown as { default: string }).default
    .slice((rolesSrc as unknown as { default: string }).default.indexOf("const MATRIX"))
    .matchAll(/^  ([a-z_]+): \{/gm),
  (m) => m[1] as RecordClass,
);

describe("billing / billing_coordinator parity", () => {
  it("found the matrix classes", () => {
    expect(CLASSES.length).toBeGreaterThan(30);
    expect(CLASSES).toContain("billing");
    expect(CLASSES).toContain("consent_ledger");
  });

  it("grants identical levels on every record class", () => {
    for (const cls of CLASSES) {
      expect([cls, canAccess("billing_coordinator", cls).level]).toEqual([
        cls,
        canAccess("billing", cls).level,
      ]);
    }
  });

  it("gives both roles the same nav", () => {
    const ids = (r: "billing" | "billing_coordinator") =>
      STAFF_NAV.filter((e) => canSeeNavEntry(r, e)).map((e) => e.id);
    expect(ids("billing_coordinator")).toEqual(ids("billing"));
  });
});

describe("Revenue & billing and Consent & privacy groups", () => {
  it("revenue holds only billing work; consent pages have their own group", () => {
    const revenue = STAFF_NAV.filter((e) => e.group === "revenue").map((e) => e.id);
    expect(revenue.sort()).toEqual(
      ["admin-claims", "billing", "billing-calaim-codes", "eligibility-worklist"].sort(),
    );
    const consent = STAFF_NAV.filter((e) => e.group === "consent").map((e) => e.id);
    expect(consent.sort()).toEqual(["consent", "consent-audit"]);
    expect(staffNavGroupsForRole("billing").map((g) => g.label)).toEqual(
      expect.arrayContaining(["Revenue & billing", "Consent & privacy"]),
    );
  });

  it("both billing roles reach Billing, Claims and CalAIM codes", () => {
    for (const r of ["billing", "billing_coordinator"] as const) {
      for (const to of ["/billing", "/admin-claims", "/billing-calaim-codes"]) {
        expect([r, to, resolveNavAccess(r, to).status]).toEqual([r, to, "allowed"]);
      }
      expect(canAccess(r, "billing").level).toBe("write");
    }
  });

  it("clinical coordinator reads CalAIM codes but not billing pages", () => {
    expect(resolveNavAccess("clinical_coordinator", "/billing-calaim-codes").status).toBe("allowed");
    expect(resolveNavAccess("clinical_coordinator", "/billing").status).toBe("denied");
    expect(resolveNavAccess("clinical_coordinator", "/admin-claims").status).toBe("denied");
    expect(canAccess("clinical_coordinator", "billing").level).toBe("none");
    // population_health READ alone (pmhnp) does not open the codes page.
    expect(resolveNavAccess("pmhnp", "/billing-calaim-codes").status).toBe("denied");
  });

  it("sys admin has billing read only — opens billing pages, can never write", () => {
    expect(canAccess("sys_admin", "billing").level).toBe("read");
    expect(canAccess("sys_admin", "billing").level).not.toBe("write");
    for (const to of ["/billing", "/admin-claims", "/billing-calaim-codes"]) {
      expect([to, resolveNavAccess("sys_admin", to).status]).toEqual([to, "allowed"]);
    }
  });
});

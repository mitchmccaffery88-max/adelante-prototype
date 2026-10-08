// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ResourceVerificationQueue } from "./ResourceVerificationQueue";
import { __resetResources, isResourceVerified, listResources, patientVisibleResources, RESOURCE_VERIFIER_ROLES } from "@/lib/communityResources";
import { getContentEntry } from "@/lib/contentPublishing";
import { AdelanteEHR } from "@/lib/ehr";
import { chartActionState } from "@/lib/chartActions";
import { canActOnCoordination } from "@/lib/coordination";
import { resolveNavAccess, entryForPath } from "@/lib/navGuard";
import { STAFF_ROLES, type StaffRole } from "@/lib/roles";
import { readFileSync } from "node:fs";

const actor = vi.hoisted(() => ({ role: "clinical_coordinator" as StaffRole, staffId: "s-cc2", staffName: "Cathy Cruz" }));
vi.mock("@/lib/roles", async (original) => ({ ...await original<typeof import("@/lib/roles")>(), useActingStaff: () => actor }));
vi.mock("@/components/ClientDate", () => ({ ClientDate: ({ value }: { value: string }) => <span>{value}</span> }));

beforeEach(() => { cleanup(); __resetResources(); actor.role = "clinical_coordinator"; });

describe("resource verification location and access", () => {
  it("removes verification from coordination and retains coverage, routing and booking order", () => {
    const route = readFileSync("src/routes/admin-coordination.tsx", "utf8");
    expect(route).not.toContain("ResourceVerificationQueue");
    expect(route.indexOf('data-testid="reassign-needed"')).toBeLessThan(route.indexOf('data-testid="coverage-list"'));
    expect(route.indexOf('data-testid="coverage-list"')).toBeLessThan(route.indexOf('data-testid="unassigned-list"'));
    expect(route.indexOf('data-testid="unassigned-list"')).toBeLessThan(route.indexOf("{canAct && <PostEnrollmentSetupCard"));
    const content = readFileSync("src/components/admin/ContentAdminWorkspace.tsx", "utf8");
    expect(content).toContain('typeId === "community_resource"');
    expect(content).toContain("<ResourceVerificationQueue />");
  });

  it("renames the menu, breadcrumb source and route metadata without changing the URL", () => {
    expect(entryForPath("/admin-content")?.label).toBe("Patient Content & Resources Center");
    const route = readFileSync("src/routes/admin-content.tsx", "utf8");
    expect(route).toContain('createFileRoute("/admin-content")');
    expect(route).toContain("Patient Content & Resources Center — Adelante");
    expect(route).not.toContain("second-reviewer approval step");
  });

  it("all previously visible verifiers retain content access; registry uses the unchanged verifier list", () => {
    for (const { key: role } of STAFF_ROLES) {
      expect(chartActionState("resource_verify", { role }).state !== "hidden").toBe(RESOURCE_VERIFIER_ROLES.includes(role));
      if (canActOnCoordination(role) && RESOURCE_VERIFIER_ROLES.includes(role)) {
        expect(resolveNavAccess(role, "/admin-content").status).toBe("allowed");
      }
    }
    for (const role of RESOURCE_VERIFIER_ROLES) expect(resolveNavAccess(role, "/admin-content").status).toBe("allowed");
  });

  it("defaults to unverified listings and reports counts from the directory", () => {
    render(<ResourceVerificationQueue />);
    const all = listResources();
    const confirmed = all.filter(isResourceVerified).length;
    expect(screen.getAllByTestId("resource-listing")).toHaveLength(all.length - confirmed);
    expect(screen.getByTestId("resource-confirmed-count").textContent).toBe(`${confirmed} of ${all.length} confirmed`);
  });

  it("verifies and publishes with the same revision attribution and one standard audit event", () => {
    render(<ResourceVerificationQueue />);
    const row = screen.getAllByTestId("resource-listing")[0];
    const id = row.getAttribute("data-resource-id");
    if (!id) throw new Error("Missing resource id");
    const beforeRev = getContentEntry("community_resource", id)?.revisions.length ?? 0;
    const beforeAudit = AdelanteEHR.listAuditEvents({}).filter((e) => e.detail?.actionId === "resource_verify").length;
    for (const field of ["Address", "Phone", "Hours"]) fireEvent.change(within(row).getByRole("textbox", { name: field }), { target: { value: `Confirmed ${field}` } });
    for (const checkbox of within(row).getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(within(row).getByRole("button", { name: "Verify and publish" }));
    expect(patientVisibleResources().some((r) => r.id === id)).toBe(true);
    const entry = getContentEntry("community_resource", id);
    expect(entry?.revisions).toHaveLength(beforeRev + 1);
    expect(entry?.revisions.at(-1)?.byStaffId).toBe("s-cc2");
    expect(AdelanteEHR.listAuditEvents({}).filter((e) => e.detail?.actionId === "resource_verify")).toHaveLength(beforeAudit + 1);
    expect(screen.queryAllByTestId("resource-listing").some((r) => r.getAttribute("data-resource-id") === id)).toBe(false);
  });

  it("keeps publish disabled for non-verifier roles", () => {
    actor.role = "therapist";
    render(<ResourceVerificationQueue />);
    expect(screen.getAllByRole("button", { name: "Verify and publish" }).every((b) => b.hasAttribute("disabled"))).toBe(true);
  });
});
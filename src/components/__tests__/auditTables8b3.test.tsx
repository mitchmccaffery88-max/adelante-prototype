// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { StaffTable, RestrictedCell } from "@/components/staff/StaffTable";
import { redactAuditEvents } from "@/lib/auditRedaction";
import type { AuditEvent } from "@/lib/ehr";
afterEach(cleanup);
it("preserves projected event IDs and never passes withheld narrative to cells", () => {
  const events = [{ id: "audit-parity", at: "2026-01-01T00:00:00Z", category: "clinical", action: "note_signed", patientId: "private-patient", detail: { noteText: "NEVER DISPLAY THIS" } }] as AuditEvent[];
  const rows = redactAuditEvents(events, "billing");
  const { container } = render(<StaffTable rows={rows} rowKey={(r) => r.event.id} label="Audit events" columns={[
    { id: "subject", label: "Patient", cell: (r) => r.subjectMasked ? <RestrictedCell label={r.subjectLabel} /> : r.subjectLabel },
    { id: "detail", label: "Detail", cell: (r) => <>{JSON.stringify(r.detail)}{r.redacted && <RestrictedCell label={r.redactionReason} />}</> },
  ]} />);
  expect(Array.from(container.querySelectorAll("[data-row-key]")).map((e) => e.getAttribute("data-row-key"))).toEqual(rows.map((r) => r.event.id));
  expect(container.textContent).not.toContain("NEVER DISPLAY THIS");
  expect(screen.getAllByRole("img").length).toBeGreaterThan(0);
});
it("keeps every audit table hook and the hidden-row gate ahead of StaffTable", () => {
  for (const [route, ids] of [
    ["admin-audit", ["admin-audit-table"]], ["admin-documents-audit", ["documents-audit-table"]],
    ["consent-audit", ["consent-audit-table", "advocate-gates-cell", "gate-"]],
    ["group-audit", ["group-audit-table", "group-audit-hidden"]], ["admin-permissions", ["action-audit-feed", "permissions-matrix"]],
    ["disclosure-log", ["disclosure-log-table", "access-log-table"]], ["quality-compliance", ["outside-caseload-report", "outside-caseload-table"]],
  ] as const) {
    const source = readFileSync(`src/routes/${route}.tsx`, "utf8");
    expect(source).toContain("<StaffTable");
    for (const id of ids) expect(source).toContain(id);
  }
  const group = readFileSync("src/routes/group-audit.tsx", "utf8");
  expect(group).toContain("redactAuditEvents(visible, role)");
  // The rollback emergency "Mark reviewed" action is retained as the row primary action.
  expect(readFileSync("src/routes/disclosure-log.tsx", "utf8")).toContain("markEmergencyReviewed(r.id, { name: me.staffName, role: me.role, staffId: me.staffId })");
});

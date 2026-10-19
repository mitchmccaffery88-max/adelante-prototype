// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StaffTable } from "@/components/staff/StaffTable";
import { AdelanteEHR } from "@/lib/ehr";
import { supervisedStaff } from "@/lib/roles";
import { hieSyncLog } from "@/lib/hie";
import { listOutboundShares } from "@/lib/dataExchange";
import { dmcOdsExportRows } from "@/lib/dmcOdsReadiness";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
afterEach(cleanup);

const projections = [
  ["sessions", () => AdelanteEHR.listTelehealthSessions({}).slice(0, 10)],
  ["sync", () => hieSyncLog(10)],
  ["outbound", () => listOutboundShares()],
  ["patients", () => AdelanteEHR.listPatients()],
  ["targets", () => AdelanteEHR.listKpiTargets(true)],
  ["rules", () => AdelanteEHR.listSchedulingRules(true)],
  ["supervision", () => supervisedStaff()],
  ["frequencies", () => AdelanteEHR.listFrequencies(true)],
  ["suppressions", () => AdelanteEHR.listCatalogSuppressions(true)],
] as const;
for (const [label, project] of projections) it(`${label} preserves projected row IDs and order`, () => {
  const rows = project().map((r) => ({ id: "id" in r ? r.id : r.code }));
  const { container } = render(<StaffTable rows={rows} rowKey={(r) => r.id} label={label} columns={[{ id: "id", label: "ID", cell: (r) => r.id }]} />);
  expect([...container.querySelectorAll("[data-row-key]")].map((r) => r.getAttribute("data-row-key"))).toEqual(rows.slice(0, 50).map((r) => r.id));
});
it("DMC projection retains denied Part 2 roles", () => {
  expect(dmcOdsExportRows("billing")).toBeNull();
  const rows = dmcOdsExportRows("billing_coordinator") ?? [];
  const { container } = render(<StaffTable rows={rows} rowKey={(r) => r["Episode ID"]} label="Preview" columns={[{ id: "id", label: "Episode ID", cell: (r) => r["Episode ID"] }]} />);
  expect([...container.querySelectorAll("[data-row-key]")].map((r) => r.getAttribute("data-row-key"))).toEqual(rows.slice(0, 50).map((r) => r["Episode ID"]));
});
it("all CSV/download function bodies are byte-identical to rollback", () => {
  for (const file of ["admin", "data-exchange", "dmc-ods-readiness"]) {
    const path = `src/routes/${file}.tsx`;
    const bodies = (text: string) => {
      const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const result: string[] = [];
      function visit(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && ["downloadCsv", "exportCsv", "download"].includes(node.name.getText(source))) result.push(node.getText(source));
        ts.forEachChild(node, visit);
      }
      visit(source); return result;
    };
    // Mitch Oct 19 (approved): only the disclosure file name changed to the program ID.
    const NEW_NAME = "a.download = disclosureCsvFilename(id);";
    const OLD_NAME = 'a.download = `disclosures-${nameOf(id).replace(/\\s+/g, "-")}.csv`;';
    expect(bodies(readFileSync(path, "utf8")).map((b) => b.replace(NEW_NAME, OLD_NAME))).toEqual(bodies(execFileSync("git", ["show", `649459806dd4:${path}`], { encoding: "utf8" })));
    if (file === "data-exchange") expect(readFileSync(path, "utf8")).toContain(NEW_NAME);
  }
});
it("CIN masking and explicit Open retain the existing drawer boundary", () => {
  const source = readFileSync("src/routes/admin.tsx", "utf8");
  expect(source).toContain('p.cin ? `••••${p.cin.slice(-4)}` : "—"');
  expect(source).toContain('onClick={() => setOpenPatientId(p.id)}>Open</Button>');
});

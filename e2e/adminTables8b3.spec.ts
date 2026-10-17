import { expect, test } from "@playwright/test";
import { bootTables, phoneTable, rowIds, tableAxe } from "./helpers/staffTables8b2";
test.use({ viewport: { width: 1280, height: 1800 } });
const cases = [
  ["/admin-vendors", "admin-vendor-sessions", "sessions"],
  ["/data-exchange", "data-exchange-health", "sync"],
  ["/data-exchange", "data-exchange-outbound", "outbound"],
  ["/dmc-ods-readiness", "dmc-ods-preview-table", "dmc"],
  ["/admin", "admin-patients", "patients"],
  ["/admin-kpi-targets", "admin-kpi-targets-table", "targets"],
  ["/admin-scheduling-rules", "admin-scheduling-rules-table", "rules"],
  ["/admin-supervision", "admin-supervision-table", "supervision"],
  ["/admin-catalog-governance", "admin-frequencies-table", "frequencies"],
  ["/admin-catalog-governance", "admin-suppressions-table", "suppressions"],
] as const;
for (const [route, tableId, projection] of cases) {
  test(`${tableId}: source parity, axe, phone and denied role`, async ({ page }) => {
    await bootTables(page, "s-admin1", "sys_admin", route);
    const expected = await page.evaluate(async (kind) => {
      const app = (window as any).__adelante;
      const ehr = app.AdelanteEHR;
      const load = (path: string): Promise<any> => import(/* @vite-ignore */ path);
      let rows: any[] = [];
      switch (kind) {
        case "sessions": rows = ehr.listTelehealthSessions({}).slice(0, 10); break;
        case "patients": rows = ehr.listPatients(); break;
        case "targets": rows = ehr.listKpiTargets(true); break;
        case "rules": rows = ehr.listSchedulingRules(true); break;
        case "frequencies": return ehr.listFrequencies(true).slice(0, 50).map((r: any) => r.code);
        case "suppressions": rows = ehr.listCatalogSuppressions(true); break;
        case "dmc": return (app.j.dmcOdsExportRows("sys_admin") ?? []).slice(0, 50).map((r: any) => r["Episode ID"]);
        // Modules without inspect exports are loaded in-page; no production helper changes.
        case "supervision": rows = (await load("/src/lib/roles.ts")).supervisedStaff(); break;
        case "sync": rows = (await load("/src/lib/hie.ts")).hieSyncLog(10); break;
        case "outbound": rows = (await load("/src/lib/dataExchange.ts")).listOutboundShares(); break;
      }
      return rows.slice(0, 50).map((r: any) => r.id);
    }, projection);
    // Existing empty-state branches intentionally do not mount a table.
    if (expected.length || await page.getByTestId(tableId).count()) {
      expect(await rowIds(page, tableId)).toEqual(expected);
      await tableAxe(page, tableId);
      await phoneTable(page, tableId);
    }
    await page.evaluate(() => {
      const app = (window as any).__adelante;
      app.setActingStaff("s-peer1", "peer_specialist");
    });
    await expect(page.getByTestId(tableId)).toHaveCount(0);
  });
}

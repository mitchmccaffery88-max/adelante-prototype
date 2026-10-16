// 8c-2 — slow-load deep link. Under a throttled CPU the staff loading gate
// holds longer; the route guard must still decide only with the saved role:
// a denied deep link lands on THAT role's safe landing, and the only
// nav_access_denied audit is attributed to the saved role, never the default.
import { test, expect } from "@playwright/test";
import { safeLandingFor } from "../src/lib/navGuard";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;

test("slow load: Cathy's denied deep link lands on her landing with no default-role audit", async ({ page, context }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    window.localStorage.setItem("adelante.actingRole", "clinical_coordinator");
    window.localStorage.setItem("adelante.actingStaffId", "s-cc2");
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });

  const landing = safeLandingFor("clinical_coordinator");
  expect(landing).toBe("/worklist");
  expect(safeLandingFor("ecm_provider")).not.toBe(landing);

  await page.goto("/case-manager", { waitUntil: "commit" });
  await page.waitForURL(`**${landing}`, { timeout: 150_000 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  await page.waitForFunction(() => Boolean((window as W).__adelante));
  const denied = await page.evaluate(() =>
    (window as W).__adelante.AdelanteEHR.listAuditEvents({}).filter((a: W) => a.action === "nav_access_denied"),
  );
  expect(denied.length).toBe(1);
  expect(denied[0].actorRole).toBe("clinical_coordinator");
  expect(denied[0].actorId).toBe("s-cc2");
  await expect(page.getByTestId("acting-role-indicator")).toContainText("Cathy");
});

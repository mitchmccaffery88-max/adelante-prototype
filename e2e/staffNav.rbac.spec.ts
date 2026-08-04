// §Platform nav — the sidebar must be exactly the `canAccess()` gate, per role.
//
// Expectations are computed from the same registry the app renders from
// (`navSections.ts`), so this suite fails when the rendered nav drifts from the
// RBAC matrix rather than when someone edits a hand-written list.
import { test, expect, type Page } from "@playwright/test";
import { STAFF_NAV, canSeeNavEntry, staffNavForRole } from "../src/lib/navSections";
import { STAFF_ROSTER, type StaffRole } from "../src/lib/roles";
import { safeLandingFor } from "../src/lib/navGuard";

const ROLES: StaffRole[] = [
  "case_manager",
  "peer_specialist",
  "therapist",
  "pmhnp",
  "billing",
  "clinical_coordinator",
  "sys_admin",
];

const staffIdFor = (role: StaffRole) =>
  STAFF_ROSTER.find((s) => s.role === role)!.id;

/** Seed the acting-role store before any app code runs. */
async function actAs(page: Page, role: StaffRole) {
  await page.addInitScript(
    ([r, id]) => {
      window.localStorage.setItem("adelante.actingRole", r as string);
      window.localStorage.setItem("adelante.actingStaffId", id as string);
      // Keep the sidebar expanded so every entry is queryable.
      window.localStorage.setItem("adelante.staffNavCollapsed", "0");
    },
    [role, staffIdFor(role)] as const,
  );
}

/** Group headers collapse by default; open them all before reading links. */
async function expandAllGroups(page: Page) {
  const sidebar = page.getByRole("complementary", { name: "Staff navigation" });
  await expect(sidebar).toBeVisible();
  for (let i = 0; i < 12; i++) {
    const closed = sidebar.locator('button[aria-expanded="false"]');
    if ((await closed.count()) === 0) break;
    await closed.first().click();
  }
}

async function visibleNavIds(page: Page): Promise<string[]> {
  await expandAllGroups(page);
  const ids = await page
    .getByRole("complementary", { name: "Staff navigation" })
    .locator("a[data-nav-id]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-nav-id")!));
  return ids.sort();
}

test.describe("staff sidebar matches the RBAC gates", () => {
  for (const role of ROLES) {
    test(`${role}: sidebar links equal staffNavForRole()`, async ({ page }) => {
      await actAs(page, role);
      await page.goto(safeLandingFor(role));

      const expected = staffNavForRole(role)
        .map((e) => e.id)
        .sort();
      expect(await visibleNavIds(page)).toEqual(expected);
    });

    test(`${role}: no gated entry leaks into the sidebar`, async ({ page }) => {
      await actAs(page, role);
      await page.goto(safeLandingFor(role));
      const rendered = new Set(await visibleNavIds(page));
      const forbidden = STAFF_NAV.filter((e) => !canSeeNavEntry(role, e)).map((e) => e.id);
      expect(forbidden.filter((id) => rendered.has(id))).toEqual([]);
    });
  }
});

test.describe("deep links honour the same gates", () => {
  for (const role of ROLES) {
    test(`${role}: allowed deep links open, denied deep links redirect`, async ({ page }) => {
      await actAs(page, role);

      const allowed = STAFF_NAV.filter((e) => canSeeNavEntry(role, e));
      const denied = STAFF_NAV.filter((e) => !canSeeNavEntry(role, e));
      const landing = safeLandingFor(role);

      // Sample to keep the run bounded but still cover both ends of the list.
      const sample = <T,>(xs: T[]) => (xs.length <= 4 ? xs : [xs[0], xs[1], xs[xs.length - 2], xs[xs.length - 1]]);

      for (const entry of sample(allowed)) {
        await page.goto(entry.to);
        await expect(page).toHaveURL(new RegExp(`${entry.to}$`));
      }

      for (const entry of sample(denied)) {
        await page.goto(entry.to);
        await expect(page).toHaveURL(new RegExp(`${landing}$`), { timeout: 10_000 });
        await expect(page.getByText(/isn't available for your role|Access restricted/i).first()).toBeVisible();
      }
    });
  }
});

test("active route is highlighted and its group is auto-expanded", async ({ page }) => {
  await actAs(page, "sys_admin");
  await page.goto("/admin-audit");
  const sidebar = page.getByRole("complementary", { name: "Staff navigation" });
  const link = sidebar.locator('a[data-nav-id="admin-audit"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
});

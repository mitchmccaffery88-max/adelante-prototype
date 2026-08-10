// §Quality pass Group B — CF Care Manager proxy-mode enforcement, end to end.
//
// The unit tests prove `canProxyForCfCareManager()` refuses a direct-mode CF
// Care Manager. That is NOT the same claim as "the product refuses it": until
// this pass the pre-release UI only asked the proxy question when the owner was
// proxy-mode, so an ECM Provider on a direct-mode owner's episode fell through
// to a self-attributed write. These tests drive the real route a user drives.
import { test, expect, type Page } from "@playwright/test";

const ECM_STAFF_ID = "s-cm1"; // Luz Herrera, ECM Provider
const DIRECT_CF = "Rosa Delgado"; // accessMode: "direct"
const PROXY_CF = "Darnell Pope (facility contract)"; // accessMode: "proxy"

/** Sign in as the ECM Provider — the only role that may ever proxy. */
async function actAsEcmProvider(page: Page) {
  await page.addInitScript(
    (id) => {
      window.localStorage.setItem("adelante.actingRole", "ecm_provider");
      window.localStorage.setItem("adelante.actingStaffId", id as string);
    },
    ECM_STAFF_ID,
  );
}

/**
 * Open a pre-release episode through the real form, owned by the named CF Care
 * Manager. The store is in-memory per page load, so each test builds its own.
 */
async function openEpisode(page: Page, cfName: string, patientIndex = 0) {
  await page.goto("/pre-release");
  await expect(page.getByRole("heading", { name: "Pre-release list" })).toBeVisible();

  await page.getByRole("combobox").first().click();
  await page.getByRole("option").nth(patientIndex).click();

  await page.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: new RegExp(cfName.split(" (")[0]) }).click();

  await page.locator('input[type="date"]').fill("2026-12-01");
  await page.getByRole("button", { name: "Open episode" }).click();
  await expect(page.getByText("Anticipated release 2026-12-01")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await actAsEcmProvider(page);
});

test("ECM Provider cannot enter task-list or care-plan work for a DIRECT-mode CF Care Manager", async ({
  page,
}) => {
  await openEpisode(page, DIRECT_CF);

  // The block is explained, not silent.
  await expect(page.getByTestId("proxy-blocked-badge")).toBeVisible();
  await expect(page.getByTestId("proxy-blocked-reason")).toContainText("logs in directly");
  await expect(page.getByTestId("proxy-mode-badge")).toHaveCount(0);

  // Task-list capture and the Reentry Care Plan are both unreachable.
  const capture = page.getByTestId(/^capture-/).first();
  await expect(capture).toBeDisabled();
  await expect(page.getByTestId("open-care-plan")).toBeDisabled();

  // And no dialog can be forced open by clicking through.
  await capture.click({ force: true }).catch(() => undefined);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the SAME ECM Provider CAN proxy-enter for a PROXY-mode CF Care Manager", async ({ page }) => {
  await openEpisode(page, PROXY_CF, 1);

  await expect(page.getByTestId("proxy-mode-badge")).toContainText("Proxy entry for Darnell Pope");
  await expect(page.getByTestId("proxy-blocked-badge")).toHaveCount(0);

  const capture = page.getByTestId(/^capture-/).first();
  await expect(capture).toBeEnabled();
  await capture.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Both identities are surfaced on the row the proxy entry produced.
  await expect(page.getByText(/Entered by Luz Herrera on behalf of Darnell Pope/)).toBeVisible();

  // The Reentry Care Plan is reachable in proxy mode too.
  await expect(page.getByTestId("open-care-plan")).toBeEnabled();
  await page.getByTestId("open-care-plan").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

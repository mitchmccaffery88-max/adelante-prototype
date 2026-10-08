import { defineConfig, devices } from "@playwright/test";

/**
 * §Platform nav — end-to-end RBAC coverage.
 *
 * Runs against the already-running dev server when one is up; otherwise it
 * starts one. The suite only exercises the staff shell, so a single Chromium
 * project is enough.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  // The dev server renders the whole in-memory demo on every load; above ~3
  // parallel browsers the redirect/expand checks start timing out.
  workers: 3,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  // §C6 Under three parallel browsers a cold page can take >5s to render its
  // first section; give every assertion the same 15s headroom.
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:4173",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 1800 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 1800 } } }],
  webServer: process.env["E2E_BASE_URL"] ? undefined : {
    command: "bun run preview:e2e",
    url: process.env["E2E_BASE_URL"] ?? "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

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
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 1400 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

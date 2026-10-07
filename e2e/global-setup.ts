// Warm the dev server once before any spec runs.
//
// Cause of the advocateSelfSeparation flake: it is alphabetically the first
// spec, so under the full suite it was the test that paid Vite's cold
// on-demand compile of the whole app graph. The `__adelante` dev hook only
// appears after that compile + hydration, which on a cold server took longer
// than the 30 s per-test budget. Warming here moves that one-off cost out of
// every test's budget; no assertion changes.
import { chromium, type FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const baseURL = (config.projects[0]?.use?.baseURL as string | undefined) ?? "http://localhost:8080";
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const path of ["/case-manager", "/advocate", "/clinician"]) {
      await page.goto(baseURL + path, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante, null, { timeout: 180_000 });
    }
  } finally {
    await browser.close();
  }
}

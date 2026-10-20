import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { bootTables } from "./helpers/staffTables8b2";

const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

async function matrix(page: Page, selector: string, name: string) {
  const region = page.locator(selector).first();
  await expect(region).toBeVisible();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 1800 });
    for (const mode of ["light", "dark"]) {
      await page.evaluate((m) => document.documentElement.classList.toggle("dark", m === "dark"), mode);
      const axe = await new AxeBuilder({ page }).include(selector).analyze();
      expect(axe.violations, `${name} ${width} ${mode}`).toEqual([]);
      if (process.env.PHASE9A3_SHOTS) await region.screenshot({ path: `${process.env.PHASE9A3_SHOTS}/${name}-${width}-${mode}.png` });
    }
  }
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.setViewportSize({ width: 1280, height: 1800 });
}

async function expected(page: Page) {
  return page.evaluate(async () => {
    const { ext } = await (window as any).__adelante.avail();
    const b = (s: string) => (["documented", "signed", "coded"].includes(s) ? "draft" : s === "generated" ? "ready" : s === "written_off" ? "write_off" : s);
    const k = { out: 0, paid: 0, denied: 0, n: {} as Record<string, number> };
    for (const c of ext.listClaims()) {
      const x = b(c.state); k.n[x] = (k.n[x] ?? 0) + 1;
      if (x === "submitted" || x === "ready") k.out += c.chargeCents ?? 0;
      if (x === "paid") k.paid += c.chargeCents ?? 0;
      if (x === "denied") k.denied += c.chargeCents ?? 0;
    }
    return k;
  });
}

for (const [id, role] of [["s-bill1", "billing"], ["s-bc1", "billing_coordinator"]] as const) {
  test(`9a-3 /billing parity, denied look, axe light/dark — ${role}`, async ({ page }) => {
    await bootTables(page, id, role, "/billing");
    await expect(page.getByTestId("billing-kpis")).toBeVisible();
    const k = await expected(page);
    const n = (s: string) => k.n[s] ?? 0;
    await expect(page.getByTestId("billing-kpi-outstanding").locator("p.text-3xl")).toHaveText(usd(k.out));
    await expect(page.getByTestId("billing-kpi-paid").locator("p.text-3xl")).toHaveText(usd(k.paid));
    await expect(page.getByTestId("billing-kpi-drafts").locator("p.text-3xl")).toHaveText(String(n("draft") + n("write_off")));
    await expect(page.getByTestId("billing-kpi-outstanding")).toContainText(`${n("ready") + n("submitted")} claims`);
    for (const s of ["draft", "ready", "submitted", "paid", "write_off", "partial"])
      await expect(page.locator(`[data-testid="billing-status-summary"] [data-billing-count="${s}"]`)).toHaveText(String(n(s)));
    // Denied card: today's exact markup, compared pixel-for-pixel with the rollback markup rendered beside it.
    const denied = page.getByTestId("billing-kpis").locator(":scope > div.rounded-xl").filter({ hasText: "Denied" });
    await expect(denied).toHaveCount(1);
    expect((await denied.evaluate((e) => e.outerHTML)).replace(/ data-tsd-source="[^"]*"/g, "")).toBe(
      `<div class="rounded-xl border bg-card p-3"><div class="text-xs text-muted-foreground">Denied</div><div class="font-display text-xl text-destructive">${usd(k.denied)}</div><div class="text-[11px] text-muted-foreground mt-0.5">${n("denied")} claims</div></div>`);
    await denied.scrollIntoViewIfNeeded();
    const box = (await denied.boundingBox())!;
    const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) };
    const live = await page.screenshot({ clip });
    // Rollback markup, rendered in the same cell, replacing the live card.
    await denied.evaluate((e, html) => { const t = document.createElement("template"); t.innerHTML = html; const ref = t.content.firstElementChild as HTMLElement; ref.id = "denied-ref"; e.style.display = "none"; e.after(ref); },
      `<div class="rounded-xl border bg-card p-3"><div class="text-xs text-muted-foreground">Denied</div><div class="font-display text-xl text-destructive">${usd(k.denied)}</div><div class="text-[11px] text-muted-foreground mt-0.5">${n("denied")} claims</div></div>`);
    const ref = await page.screenshot({ clip });
    expect(live.equals(ref)).toBe(true);
    await page.evaluate(() => { const r = document.getElementById("denied-ref"); (r?.previousElementSibling as HTMLElement).style.display = ""; r?.remove(); });
    const chip = page.locator('[data-testid="billing-status-summary"] [data-billing-status-filter="denied"] .bg-destructive\\/15');
    await expect(chip).toHaveText(String(n("denied")));
    await matrix(page, '[data-testid="billing-kpis"]', `billing-kpis-${role}`);
    await matrix(page, '[data-testid="billing-status-summary"]', `billing-status-${role}`);
  });
}

test("9a-3 /county-reporting tiles keep Simulated, axe light/dark", async ({ page }) => {
  await bootTables(page, "s-bc1", "billing_coordinator", "/county-reporting");
  const cards = page.getByTestId("county-cards");
  await expect(cards.locator("[data-stat-tile]").first()).toBeVisible();
  await expect(page.getByText("Simulated").first()).toBeVisible();
  expect(await cards.innerHTML()).not.toMatch(/text-navy|amber|emerald/);
  await matrix(page, '[data-testid="county-cards"]', "county-cards");
});

test("9a-3 /quality-compliance: axe light/dark; therapist cannot see billing tiles", async ({ page }) => {
  await bootTables(page, "s-admin1", "sys_admin", "/quality-compliance");
  await expect(page.getByTestId("outside-caseload-report")).toBeVisible();
  await matrix(page, "main", "quality-compliance");
  await page.evaluate(() => { const a = (window as any).__adelante; a.setActingStaff("s-th1", "therapist"); a.go("/billing"); });
  await page.waitForTimeout(800);
  await expect(page.getByTestId("billing-kpis")).toHaveCount(0);
});

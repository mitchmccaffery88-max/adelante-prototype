// Phase 8a-1 — staff shell and compact density in the browser.
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function actAs(page: Page, role: string, id: string) {
  await page.addInitScript(([r, i]) => {
    window.localStorage.setItem("adelante.actingRole", r as string);
    window.localStorage.setItem("adelante.actingStaffId", i as string);
  }, [role, id] as const);
}

async function ready(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante, null, { timeout: 60_000 });
}

const STAFF_PATHS = ["/my-work", "/clinician", "/record/p1", "/admin-content"];

test.describe("8a-1 staff shell", () => {
  for (const path of STAFF_PATHS) {
    test(`${path} renders compact staff shell with 14px floor`, async ({ page }) => {
      await page.goto(path);
      const shell = page.getByTestId("staff-shell");
      await expect(shell).toHaveAttribute("data-density", "compact");
      await expect(page.getByTestId("staff-shell-header")).toBeVisible();
      const small = await page.evaluate(() => {
        const host = document.querySelector('[data-testid="staff-shell"]')!;
        const out: string[] = [];
        host.querySelectorAll<HTMLElement>("body *:not(svg *):not(.recharts-wrapper *)").forEach((el) => {
          if (el.closest(".member-comfortable,[data-member-preview]")) return;
          if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) return;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          if (parseFloat(getComputedStyle(el).fontSize) < 14) out.push(el.tagName + ":" + el.textContent!.trim().slice(0, 30));
        });
        return out;
      });
      expect(small).toEqual([]);
      const axe = await new AxeBuilder({ page }).include('[data-testid="staff-shell-header"]').analyze();
      expect(axe.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
    });
  }

  test("header is 56px and has no language toggle", async ({ page }) => {
    await page.goto("/my-work");
    const box = await page.getByTestId("staff-shell-header").boundingBox();
    expect(Math.round(box!.height)).toBe(56);
    await expect(page.getByTestId("staff-shell-header").getByRole("button", { name: /español|english|language/i })).toHaveCount(0);
  });

  test("quick jump opens with the keyboard and lists permitted surfaces", async ({ page }) => {
    await page.goto("/my-work");
    await ready(page);
    await page.getByRole("button", { name: "Quick jump" }).focus();
    await page.keyboard.press("Enter");
    const input = page.getByLabel("Quick jump to a surface");
    await expect(input).toBeVisible();
    await input.fill("zzzz-no-match");
    await expect(page.getByText("No matching surfaces.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(input).toBeHidden();
  });

  test("crisis count never appears without visible open crisis rows", async ({ page }) => {
    await actAs(page, "billing", "s-bill1");
    await page.goto("/billing");
    await expect(page.getByTestId("staff-shell")).toBeVisible();
    await expect(page.getByRole("link", { name: /open crisis escalations/ })).toHaveCount(0);
  });

  test("phone: navigation opens as a sheet from the header menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/my-work");
    await ready(page);
    await page.getByRole("button", { name: "Open staff navigation" }).click();
    await expect(page.getByTestId("staff-navigation-sheet")).toBeVisible();
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(sw).toBeLessThanOrEqual(390);
  });

  test("chart + New opens the existing launcher from the shell slot", async ({ page }) => {
    await page.goto("/record/p1");
    await ready(page);
    const slot = page.getByTestId("staff-new-slot");
    await expect(slot.getByRole("button").first()).toBeVisible();
    await slot.getByRole("button").first().click();
    await expect(page.getByRole("menu").or(page.getByRole("dialog")).first()).toBeVisible();
  });

  test("patient Home stays outside the staff shell", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByTestId("staff-shell")).toHaveCount(0);
    await expect(page.locator('[data-density="compact"]')).toHaveCount(0);
  });
});

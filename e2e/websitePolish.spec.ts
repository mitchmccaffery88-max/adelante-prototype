import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of ["/", "/about", "/team"]) {
  test(`public polish and accessibility ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByTestId("website-layout")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://adelmvp1.lovable.app/website-share.jpg");
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", "https://adelmvp1.lovable.app/website-share.jpg");
    const response = await page.request.get("/website-share.jpg");
    expect(response.ok()).toBe(true);
    const headingStyles = await page.locator(".website-heading").evaluateAll((els) => els.filter(el => !el.closest(".website-closing")).map(el => {
      const s = getComputedStyle(el); return [s.fontFamily, s.fontSize, s.color, s.fontWeight];
    }));
    for (const style of headingStyles) expect(style).toEqual(headingStyles[0]);
    await expect(page.getByTestId("website-header").locator("nav:visible [aria-current]")).toHaveCount(path === "/" ? 0 : 1);
    const result = await new AxeBuilder({ page }).include('[data-testid="website-layout"]').analyze();
    expect(result.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
    if (path === "/") {
      await expect(page.locator(".website-hero")).not.toContainText("Adelante Health");
      for (const id of ["how-it-works", "find-your-fit", "what-you-get", "faq"]) {
        await page.getByTestId("website-header").locator(`a[href="/#${id}"]`).click();
        await expect.poll(() => page.getByTestId("website-header").locator("nav:visible [aria-current]").count()).toBe(1);
        await expect(page.getByTestId("website-header").locator("nav:visible [aria-current]")).toHaveAttribute("href", `/#${id}`);
      }
    }
    if (path === "/about") {
      expect(await page.getByTestId("website-mission-grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(2);
    }
    if (path !== "/about") {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const top = page.getByRole("button", { name: "Back to top", exact: true });
      await expect(top).toBeVisible();
      await top.focus(); await page.keyboard.press("Enter");
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(top).not.toBeVisible();
    }
    for (const viewport of [{ width: 1280, height: 1800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const clear = () => page.getByTestId("website-layout").evaluate(el => {
        const crisis = el.querySelector('[aria-label="Crisis support"]');
        return !!crisis && parseFloat(getComputedStyle(el).paddingBottom) >= crisis.getBoundingClientRect().height;
      });
      await expect.poll(clear).toBe(true);
      await page.getByTestId("website-footer").getByRole("link", { name: "Make a referral", exact: true }).focus();
      await expect.poll(() => page.evaluate(() => {
        const active = document.activeElement?.getBoundingClientRect();
        const bar = document.querySelector('[aria-label="Crisis support"]')?.getBoundingClientRect();
        return !!active && !!bar && active.bottom <= bar.top;
      })).toBe(true);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      if (viewport.width === 390) {
        if (path === "/about") expect(await page.getByTestId("website-mission-grid").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(1);
        const header = page.getByTestId("website-header");
        await expect(header.getByRole("button", { name: "Switch language to English" })).not.toBeVisible();
        await expect(header.getByRole("link", { name: "Sign in", exact: true })).not.toBeVisible();
        await expect(header.getByRole("link", { name: "Get started", exact: true })).toBeVisible();
        await header.getByRole("button", { name: "Open website menu" }).click();
        const menu = page.locator("#website-mobile-nav");
        await expect(menu.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
        await expect(menu).toContainText("HIPAA · 42 CFR Part 2");
        await menu.getByRole("button", { name: "Cambiar idioma a español" }).click();
        await expect(menu.getByRole("button", { name: "Cambiar idioma a español" })).toHaveAttribute("aria-pressed", "true");
        await page.keyboard.press("Escape");
        await expect(page.getByText("ES Draft — pending translation review", { exact: true })).toBeVisible();
        const esResult = await new AxeBuilder({ page }).include('[data-testid="website-layout"]').analyze();
        expect(esResult.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
      }
    }
  });
}
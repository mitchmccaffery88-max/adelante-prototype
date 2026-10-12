import { test, expect } from "@playwright/test";

for (const lang of ["en", "es"] as const) {
  test(`public website ${lang}: sections, anchors, legacy link and flows`, async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
    await page.getByRole("button", { name: lang === "es" ? "Cambiar idioma a español" : "Switch language to English", exact: true }).click();
    const titles = lang === "en" ? ["How it works", "About Us", "Meet Our Team", "Find Where You Fit", "What you get"] : ["Cómo funciona", "Sobre Nosotros", "Conoce a Nuestro Equipo", "Encuentra Tu Lugar", "Qué recibes"];
    const ids = ["how-it-works", "about", "team", "find-your-fit", "what-you-get"];
    const labels = lang === "en" ? ["How it works", "About us", "Our team", "Find where you fit", "What you get"] : ["Cómo funciona", "Sobre nosotros", "Nuestro equipo", "Encuentra tu lugar", "Qué recibes"];
    for (let i = 0; i < ids.length; i++) {
      await expect(page.locator(`#${ids[i]}`).getByRole("heading", { name: titles[i], exact: true })).toBeVisible();
      await page.getByRole("navigation", { name: lang === "en" ? "Website navigation" : "Navegación del sitio web", exact: true }).getByRole("link", { name: labels[i], exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${ids[i]}$`));
      // Near the footer the document may not have enough remaining height to
      // align the last section at scroll-margin; assert the exact reachable position.
      await expect.poll(() => page.locator(`#${ids[i]}`).evaluate((el) => {
        const top = el.getBoundingClientRect().top;
        const target = Math.max(parseFloat(getComputedStyle(el).scrollMarginTop), top + scrollY - (document.documentElement.scrollHeight - innerHeight));
        return Math.abs(top - target);
      })).toBeLessThan(2);
    }
    await expect(page).toHaveTitle(/Adelante Health/);
    for (const tag of ["og:title", "twitter:title"]) await expect(page.locator(`meta[${tag === "og:title" ? "property" : "name"}="${tag}"]`)).toHaveAttribute("content", /Adelante Health/);
    await expect(page.getByRole("region", { name: "Crisis support", exact: true })).toBeVisible();
    await expect(page.locator("#team img")).toHaveCount(0);
    await expect(page.locator("#team li")).toHaveCount(7);
    await expect(page.locator("#team")).not.toContainText(/Luis Camacho|Mitch|Dr\.|Christi|Bagga/);
    if (lang === "es") await expect(page.getByText("ES Draft — pending translation review", { exact: true })).toBeVisible();
    await page.evaluate(() => { window.location.hash = "who-its-for"; });
    await expect(page).toHaveURL(/#find-your-fit$/);
    await expect.poll(() => page.locator("#find-your-fit").evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(220);
    const fit = page.locator("#find-your-fit");
    const start = lang === "en" ? "Get started" : "Comenzar";
    const help = lang === "en" ? "I want to help someone" : "Quiero ayudar a alguien";
    await expect(fit.getByRole("link", { name: start }).first()).toHaveAttribute("href", "/start/signup");
    await expect(fit.getByRole("link", { name: help })).toHaveAttribute("href", "/advocate");
    await fit.getByRole("link", { name: start }).first().click();
    await expect(page).toHaveURL(/\/start\/signup$/);
    await expect(page.locator('[data-testid="public-landing"]')).toHaveCount(0);
    await page.goto("/");
    await page.locator("#find-your-fit").getByRole("link", { name: help }).click();
    await expect(page).toHaveURL(/\/advocate$/);
  });
}

test("public website mobile menu and direct legacy anchor", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#who-its-for");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
  await expect(page).toHaveURL(/#find-your-fit$/);
  await page.getByRole("button", { name: "Switch language to English", exact: true }).click();
  await page.getByRole("button", { name: "Open website menu" }).click();
  const nav = page.locator("#website-mobile-nav");
  await expect(nav.getByRole("link")).toHaveCount(5);
  await nav.getByRole("link", { name: "Our team", exact: true }).click();
  await expect(page).toHaveURL(/#team$/);
  await expect(nav).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("region", { name: "Crisis support", exact: true })).toBeVisible();
});
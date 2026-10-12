import { test, expect, type Page } from "@playwright/test";
import { websiteEn, websiteEs } from "../src/lib/i18n.website";

async function anchorAligned(page: Page, id: string) {
  await expect.poll(() => page.locator(`#${id}`).evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const target = Math.max(parseFloat(getComputedStyle(el).scrollMarginTop), top + scrollY - (document.documentElement.scrollHeight - innerHeight));
    return Math.abs(top - target);
  })).toBeLessThan(2);
}

for (const lang of ["en", "es"] as const) {
  test(`public website ${lang}: separate pages, shared layout, navigation and copy`, async ({ page }) => {
    const d = lang === "en" ? websiteEn : websiteEs;
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
    await page.getByRole("button", { name: lang === "es" ? "Cambiar idioma a español" : "Switch language to English", exact: true }).click();
    const headerLinks = await page.getByTestId("website-header").locator("a").evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute("href")]));
    const footerLinks = await page.getByTestId("website-footer").locator("a").evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute("href")]));
    for (const route of ["/", "/about", "/team"] as const) {
      if (route !== "/") {
        await page.getByTestId("website-header").getByRole("link", { name: route === "/about" ? d.websiteAboutNav : d.websiteTeamNav, exact: true }).click();
      }
      await expect(page).toHaveURL(new RegExp(`${route === "/" ? "/" : route}$`));
      await expect(page.getByRole("region", { name: "Crisis support", exact: true })).toBeVisible();
      expect(await page.getByTestId("website-header").locator("a").evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute("href")]))).toEqual(headerLinks);
      expect(await page.getByTestId("website-footer").locator("a").evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute("href")]))).toEqual(footerLinks);
      if (lang === "es") await expect(page.getByText("ES Draft — pending translation review", { exact: true })).toBeVisible();
      if (route === "/") {
        await expect(page.locator("#about, #team, #partners, [data-testid=website-privacy]")).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(d.websiteHeroHeading);
      } else {
        const title = route === "/about" ? "About Us — Adelante Health" : "Our Team — Adelante Health";
        await expect(page).toHaveTitle(title);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
        await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", title);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", route === "/about" ? websiteEn.websiteDescription : websiteEn.websiteTeamIntro);
        await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", route === "/about" ? websiteEn.websiteDescription : websiteEn.websiteTeamIntro);
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://adelmvp1.lovable.app${route}`);
        await expect(page.getByTestId("website-header").locator('[aria-current="page"]')).toHaveText(route === "/about" ? d.websiteAboutNav : d.websiteTeamNav);
        if (route === "/about") {
          await expect(page.locator("#about")).toContainText(d.websiteMission);
          await expect(page.locator("#partners")).toContainText(d.websitePartnersBody);
          await expect(page.getByTestId("website-privacy")).toHaveText(d.websitePrivacyLine);
          await expect(page.locator("blockquote")).toHaveCount(0);
          await expect(page.locator("#partners").getByRole("link", { name: d.websiteReferral })).toHaveAttribute("href", "/referral");
        } else {
          await expect(page.locator("#team")).toContainText(d.websiteTeamIntro);
          await expect(page.locator("#team li")).toHaveCount(7);
          await expect(page.locator("#team img")).toHaveCount(0);
          await expect(page.locator("#team")).not.toContainText(/Luis Camacho|Mitch|Dr\.|Christi|Bagga/);
          for (const key of ["websiteCareTeam", "websiteNavigationTeam", "websiteResourceTeam", "websiteAdvocateTeam"] as const) await expect(page.locator("#team")).toContainText(d[key]);
          await expect(page.getByRole("link", { name: d.websiteFitNav, exact: true }).last()).toHaveAttribute("href", "/#find-your-fit");
        }
        await expect(page.getByRole("heading", { name: d.websiteReady, exact: true })).toBeVisible();
      }
    }
    await page.getByTestId("website-header").getByRole("link", { name: d.websiteFaqNav, exact: true }).click();
    await expect(page).toHaveURL(/\/#faq$/); await anchorAligned(page, "faq");
    const q = page.locator("#faq").getByRole("button", { name: d.websiteFaqCrisisQ });
    await q.focus(); await page.keyboard.press("Enter");
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#faq")).toContainText("988");
    await page.keyboard.press("Enter"); await expect(q).toHaveAttribute("aria-expanded", "false");
    await page.getByTestId("website-footer").getByRole("link", { name: d.websitePartners, exact: true }).click();
    await expect(page).toHaveURL(/\/about#partners$/); await anchorAligned(page, "partners");
    await page.getByTestId("website-footer").getByRole("link", { name: d.websiteReferral, exact: true }).click();
    await expect(page).toHaveURL(/\/referral$/);
    await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  });
}

for (const [old, target] of [["about", "/about"], ["team", "/team"], ["partners", "/about#partners"], ["who-its-for", "/#find-your-fit"]]) {
 test(`legacy public anchor ${old}`, async ({ page }) => {
   await page.goto(`/#${old}`);
   await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
   await expect(page).toHaveURL(new RegExp(`${target}$`));
   await expect(page.getByRole("region", { name: "Crisis support", exact: true })).toBeVisible();
 });
}
for (const from of ["/", "/about", "/team"]) {
 test(`homepage anchors from ${from}`, async ({ page }) => {
   await page.goto(from);
   await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
   await page.getByRole("button", { name: "Switch language to English", exact: true }).click();
   for (const [id, name] of [["how-it-works", "How it works"], ["find-your-fit", "Find where you fit"], ["what-you-get", "What you get"], ["faq", "FAQ"]]) {
     await page.getByTestId("website-header").getByRole("link", { name, exact: true }).click();
     await expect(page).toHaveURL(new RegExp(`/#${id}$`)); await anchorAligned(page, id);
     if (from !== "/") {
       await page.getByTestId("website-header").getByRole("link", { name: from === "/about" ? "About us" : "Our team", exact: true }).click();
       await expect(page).toHaveURL(new RegExp(`${from}$`));
     }
   }
 });
}
test("public website mobile menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open website menu" }).click();
  const nav = page.locator("#website-mobile-nav");
   await nav.getByRole("button", { name: "Switch language to English", exact: true }).click();
   await expect(nav.locator("nav").getByRole("link")).toHaveCount(6);
  await nav.getByRole("link", { name: "Our team", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
   await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meet Our Team");
  await expect(nav).toHaveCount(0);
  await page.getByRole("button", { name: "Open website menu" }).click();
  await expect(nav.locator('[aria-current="page"]')).toHaveText("Our team");
  await nav.getByRole("link", { name: "FAQ", exact: true }).click();
  await expect(page).toHaveURL(/\/#faq$/); await anchorAligned(page, "faq");
});

test("public referral accepts no agency but requires referrer name", async ({ page }) => {
  await page.goto("/referral");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: unknown }).__adelante);
  const form = page.locator("form");
  // Labels in the shared Field wrap an input sibling, not a label-for pair.
  const input = (label: string) => form.locator("label").filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).locator("..").locator("input");
  await input("First name *").fill("OptionalAgency");
  await input("Last name *").fill("PublicWalkthrough");
  await input("Date of birth (or Medi-Cal ID below) *").fill("1989-02-08");
  await form.getByRole("button", { name: "No", exact: true }).click();
  await page.getByTestId("referral-person-email").fill("person@example.org");
  await form.getByRole("checkbox", { name: /No reliable phone/ }).focus();
  await page.keyboard.press("Space");
  await expect(form.getByRole("checkbox", { name: /No reliable phone/ })).toBeChecked();
  await form.getByRole("checkbox", { name: /not a robot/ }).focus();
  await page.keyboard.press("Space");
  await expect(form.getByRole("checkbox", { name: /not a robot/ })).toBeChecked();
  await form.getByRole("button", { name: /Send referral|Submit referral/ }).click();
  await expect(page.getByText("Please complete the required fields", { exact: true })).toBeVisible();
  await expect(page.getByTestId("referral-confirmation")).toHaveCount(0);
  await input("Your name *").fill("Referral Walker");
  await expect(input("Agency / organization")).toHaveValue("");
  await form.getByRole("button", { name: /Send referral|Submit referral/ }).click();
  await expect(page.getByTestId("referral-confirmation")).toBeVisible();
  const saved = await page.evaluate(() => {
    const w = window as unknown as { __adelante: { AdelanteEHR: { listReferrals: () => Array<{ firstName: string; referringAgency: string; referrerName: string }> } } };
    return w.__adelante.AdelanteEHR.listReferrals().find((r) => r.firstName === "OptionalAgency");
  });
  expect(saved?.referringAgency).toBe("");
  expect(saved?.referrerName).toBe("Referral Walker");
});

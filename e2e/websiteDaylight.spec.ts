import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DAYLIGHT_PUBLIC_ROUTES } from "../src/lib/websiteMenus";

for (const width of [1280,390]) for (const lang of ["en","es"]) {
 test(`Daylight shell ${width} ${lang}: menus, focus, clearance and contrast`,async ({page}) => {
  await page.setViewportSize({width,height:width === 390 ? 844 : 1800});
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as {__adelHydrated:boolean}).__adelHydrated);
  const header=page.getByTestId("website-header");
  const menu=header.getByRole("button",{name:lang === "es" ? "Abrir menú del sitio web" : "Open website menu",exact:true});
  if(width === 390) await header.getByRole("button",{name:"Open website menu",exact:true}).click();
  if(lang === "es") await page.getByRole("button",{name:"Cambiar idioma a español",exact:true}).click();
  const care=page.getByRole("button",{name:lang === "es" ? "Recibir atención" : "Get care",exact:true});
  await care.click(); await expect(care).toHaveAttribute("aria-expanded","true");
  if(width === 1280) {
   const team=header.getByRole("button",{name:lang === "es" ? "Nuestro equipo" : "Our team",exact:true});
   await team.click(); await expect(care).toHaveAttribute("aria-expanded","false");
   await page.keyboard.press("Escape"); await expect(team).toBeFocused();
   await care.click();
  } else {
   const dialog=page.getByRole("dialog");
   const close=dialog.getByRole("button",{name:lang === "es" ? "Cerrar menú" : "Close menu",exact:true});
   await close.focus(); await page.keyboard.press("Shift+Tab");
   expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
   await page.keyboard.press("Tab");
   expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
   expect(await page.locator("body").evaluate(el => getComputedStyle(el).overflow)).toBe("hidden");
  }
  await expect(page.locator(width === 390 ? "#website-phone-care" : "#website-mega-care")).toBeVisible();
  const axe=await new AxeBuilder({page}).include(width === 390 ? ".website-menu-sheet" : '[data-testid="website-header"]').include(".website-crisis").analyze();
  expect(axe.violations.filter(v=>v.impact === "serious" || v.impact === "critical")).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`/tmp/browser/daylight/verified-${width}-${lang}.png`});
  await page.keyboard.press("Escape");
  await expect(width === 390 ? menu : care).toBeFocused();
  const crisis=page.locator(".website-crisis"); await expect(crisis).toBeVisible();
  expect(await crisis.evaluate(el => el.getBoundingClientRect().bottom)).toBe(width === 390 ? 844 : 1800);
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await expect(page.getByRole("button",{name:lang === "es" ? "Volver arriba" : "Back to top",exact:true})).toBeVisible();
  const footer=await page.getByTestId("website-footer").boundingBox(); const bar=await crisis.boundingBox();
  expect(footer && bar && footer.y+footer.height <= bar.y+1).toBe(true);
  await page.getByRole("button",{name:lang === "es" ? "Volver arriba" : "Back to top",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
  await expect(page.locator("#website-top")).toBeFocused();
 });
}
test("Daylight crisis bar and one public shell on every public destination and entry flow",async ({page}) => {
 test.setTimeout(120_000);
 for(const route of ["/","/about","/team","/referral","/auth","/start","/start/signup","/start/helping","/start/support","/start/reconnect","/start/other-help",...DAYLIGHT_PUBLIC_ROUTES]) {
  await page.goto(route); await expect(page.getByTestId("website-layout")).toHaveCount(1);
  await expect(page.locator(".website-crisis")).toBeVisible();
  await expect(page.locator('.website-crisis a[href="tel:988"]')).toHaveText("988");
  await expect(page.locator("main")).toHaveCount(1);
  expect(await page.title()).not.toMatch(/Lovable/);
 }
});
test("Daylight reduced motion and shrinking sticky header",async ({page}) => {
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.goto("/"); await page.waitForFunction(()=>(window as unknown as {__adelHydrated:boolean}).__adelHydrated);
 const row=page.locator(".website-header-row"); await expect.poll(()=>row.evaluate(el=>el.getBoundingClientRect().height)).toBe(104);
 await page.evaluate(()=>window.scrollTo(0,500));
 await expect.poll(()=>row.evaluate(el=>el.getBoundingClientRect().height)).toBe(72);
 expect(await row.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe("0s");
});

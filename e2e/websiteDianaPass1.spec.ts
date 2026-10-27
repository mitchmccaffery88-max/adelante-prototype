// Diana pass 1 (27 Oct): new mission/values, flyout and service interactions.
import { test, expect } from '@playwright/test';
import { websiteEn, websiteEs } from '../src/lib/i18n.website';
import { coreValues } from '../src/lib/website/dianaConfig';
for (const width of [1280,390]) for (const lang of ['en','es'] as const) test(`Diana pass 1 ${width} ${lang}`, async ({ page }) => {
 const d = lang === 'en' ? websiteEn : websiteEs;
 await page.setViewportSize({ width, height: width === 390 ? 844 : 1800 });
 await page.goto('/'); await page.waitForFunction(() => (window as any).__adelHydrated);
 if (lang === 'es') {
  if (width === 390) await page.getByRole('button',{name:'Open website menu',exact:true}).click();
  await page.getByRole('button',{name:'Cambiar idioma a español',exact:true}).click();
  if (width === 390) await page.keyboard.press('Escape');
 }
 const hero = page.getByTestId('landing-hero');
 await expect(hero.getByRole('link',{name:d.websiteStart,exact:true})).toHaveAttribute('href','/start/signup');
 await expect(hero.getByRole('link',{name:d.websiteHelp,exact:true})).toHaveAttribute('href','/referral');
 await expect(hero.locator('.daylight-actions svg,.daylight-service-chip')).toHaveCount(0);
 const mission = await page.locator('.daylight-mission-copy').innerText();
 await expect(page.locator('.daylight-values-band ul li')).toHaveText(coreValues.map(key=>d[key]));
 const control=page.getByRole('button',{name:d['website.diana.values.pause'],exact:true});await control.click();
 await expect(page.getByRole('button',{name:d['website.diana.values.play'],exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await page.locator('.daylight-values-track').evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused');
 const groups=page.locator('#core-services').getByRole('button',{name:d['website.diana.groups'],exact:true});
 // Keyboard focus opens on desktop; a click is the phone accordion interaction.
 if(width===1280) { await groups.press('Tab'); await groups.focus(); } else { await groups.click(); }
 await expect(groups).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('#service-groups')).toContainText(d['website.diana.groups.body']);
 await page.locator('#service-groups').screenshot({path:`/tmp/browser/diana/group-detail-${width}-${lang}.png`});
 if(width===390) await page.getByRole('button',{name:d['website.v2.open'],exact:true}).click();
 await page.getByRole('button',{name:d['website.v2.care'],exact:true}).click();
 const category=page.getByRole('button',{name:d['website.v2.who'],exact:true});
 if(width===390) await category.click(); else await category.hover();
 await expect(category).toHaveAttribute('aria-expanded','true');
 const panel=page.locator(width===390?'#website-phone-care':'#website-mega-care');
 await expect(panel.getByRole('link',{name:new RegExp(d['website.v2.anyone'])})).toBeVisible();
 if(width===1280) { await category.focus(); await page.keyboard.press('ArrowRight'); await expect(panel.getByRole('link').first()).toBeFocused(); }
 await page.keyboard.press('Escape');
 await page.goto('/about'); await page.waitForFunction(()=>(window as any).__adelHydrated);
 await expect(page.locator('#about p')).toHaveText(mission);
 await expect(page.locator('.page-values h3')).toHaveText(coreValues.map(key=>d[key]));
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Diana values are static under reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await page.waitForFunction(()=>(window as any).__adelHydrated);
 expect(await page.locator('.daylight-values-track').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await expect(page.locator('.daylight-values-list').nth(1)).toBeHidden();
 await expect(page.locator('.daylight-values-control')).toBeHidden();
});
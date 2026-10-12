import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { websiteEn, websiteEs, WEBSITE_NAV } from "@/lib/i18n.website";

const landing = readFileSync("src/components/Landing.tsx", "utf8");
const shell = readFileSync("src/components/AppShell.tsx", "utf8");
const content = readFileSync("src/components/WebsiteContent.tsx", "utf8");
const layout = readFileSync("src/components/WebsiteLayout.tsx", "utf8");
const index = readFileSync("src/routes/index.tsx", "utf8");

describe("public website contract", () => {
  it("has a Spanish draft translation for every public string", () => {
    expect(Object.keys(websiteEs).sort()).toEqual(Object.keys(websiteEn).sort());
    for (const text of Object.values(websiteEs)) expect(text.length).toBeGreaterThan(0);
    expect(websiteEs.websiteDraft).toBe("ES Draft — pending translation review");
  });
  it("keeps Mitch's mission and closing copy verbatim", () => {
    expect(websiteEn.websiteMission).toBe("Adelante Health's Complete Wrap-Around Care provides whole-person, continuous care to anyone who needs it, wherever they are, bringing together mental and behavioral health, telepsychiatry, smart pathways to substance use recovery, and the everyday resources that make healing possible. As a hospital without walls, we serve every person with the same commitment, and we proudly pioneered care for people coming home from incarceration, walking alongside them and their advocates through the critical first 90 days and beyond so every fresh start becomes a lasting one.");
    expect(websiteEn.websiteReadyBody).toBe("Wherever you're starting from, we'll meet you there. Connect with our team to take your next step forward.");
  });
  it("orders sections and navigation and preserves the old anchor", () => {
    expect(WEBSITE_NAV.map((n) => [n.to, n.hash])).toEqual([["/", "how-it-works"], ["/about", undefined], ["/team", undefined], ["/", "find-your-fit"], ["/", "what-you-get"], ["/", "faq"]]);
    for (const id of ["about", "team", "partners"]) expect(landing).not.toContain(`id="${id}"`);
    for (const id of ["about", "team", "partners"]) expect(content).toContain(`id="${id}"`);
    expect(landing).toContain('hash !== "#who-its-for"');
    expect(landing).toContain('to: "/about"');
    expect(landing).toContain('to: "/team"');
    expect(landing).toContain('hash: "find-your-fit"');
  });
  it("isolates public branding and preserves crisis support and existing flows", () => {
    expect(shell).toContain("if (isPublicSurface) return <WebsiteLayout>{STAFF_ROUTES.includes(pathname) && <RouteAccessGuard />}<Outlet /></WebsiteLayout>");
    expect(layout).toContain("<WebsiteBrand />");
    expect(layout).toContain('t("websiteBrand")');
    expect(shell).toContain('href="tel:988"');
    expect(landing).toContain('to="/start/signup"');
    expect(landing).toContain('to="/advocate"');
    expect(index).toContain("websiteEn.websiteTitle");
    expect(websiteEn.websiteTitle).toBe("Adelante Health — Whole-Person Care, Wherever You Are");
  });
  it("follow-ups: quote gone, root meta, partners, privacy, FAQ, no numbers", () => {
    expect(landing).not.toContain("blockquote");
    expect("websiteQuote" in websiteEn).toBe(false);
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).not.toContain("Adelante Pathways");
    expect(root).toContain('content: "Adelante" }');
    expect(content).toContain('id="partners"');
    expect(content).toContain('to="/referral"');
    expect(content).toContain('data-testid="website-privacy"');
    expect(landing).not.toContain("websitePrivacyLine");
    expect(landing.indexOf('id="faq"')).toBeLessThan(landing.lastIndexOf("<WebsiteClosing"));
    expect(websiteEn.websiteHeroHeading).toBe("Forward starts here.");
    expect(websiteEn.websiteHeroEyebrow).toBe("Care for anyone, wherever you are");
    for (const dict of [websiteEn, websiteEs]) for (const text of Object.values(dict)) {
      const nums = (text.match(/\d+/g) ?? []).filter((n) => !["988", "911", "90", "2", "42"].includes(n));
      expect(nums, text).toEqual([]);
    }
  });
});

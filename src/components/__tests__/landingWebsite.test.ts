import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { websiteEn, websiteEs, WEBSITE_NAV } from "@/lib/i18n.website";

const landing = readFileSync("src/components/Landing.tsx", "utf8");
const shell = readFileSync("src/components/AppShell.tsx", "utf8");
const index = readFileSync("src/routes/index.tsx", "utf8");

describe("public website contract", () => {
  it("has a Spanish draft translation for every public string", () => {
    expect(Object.keys(websiteEs).sort()).toEqual(Object.keys(websiteEn).sort());
    for (const text of Object.values(websiteEs)) expect(text.length).toBeGreaterThan(0);
    expect(websiteEs.websiteDraft).toBe("ES Draft — pending translation review");
  });
  it("keeps Mitch's mission and closing copy verbatim", () => {
    expect(websiteEn.websiteMission).toBe("Adelante Complete Wrap-Around Care provides whole-person, continuous care to anyone who needs it, wherever they are, bringing together mental and behavioral health, telepsychiatry, smart pathways to substance use recovery, and the everyday resources that make healing possible. As a hospital without walls, we serve every person with the same commitment, and we proudly pioneered care for people coming home from incarceration, walking alongside them and their advocates through the critical first 90 days and beyond so every fresh start becomes a lasting one.");
    expect(websiteEn.websiteReadyBody).toBe("Wherever you're starting from, we'll meet you there. Connect with our team to take your next step forward.");
  });
  it("orders sections and navigation and preserves the old anchor", () => {
    expect(WEBSITE_NAV.map((n) => n.hash)).toEqual(["how-it-works", "about", "team", "find-your-fit", "what-you-get"]);
    let last = -1;
    for (const n of WEBSITE_NAV) {
      const position = landing.indexOf(`id="${n.hash}"`);
      expect(position).toBeGreaterThan(last);
      last = position;
    }
    expect(landing).toContain('window.location.hash !== "#who-its-for"');
    expect(landing).toContain('"", "#find-your-fit"');
  });
  it("isolates public branding and preserves crisis support and existing flows", () => {
    expect(shell).toContain("isPublicSurface ? <WebsiteBrand />");
    expect(shell).toContain('isPublicSurface ? t("websiteBrand") : "Adelante"');
    expect(shell).toContain('href="tel:988"');
    expect(landing).toContain('to="/start/signup"');
    expect(landing).toContain('to="/advocate"');
    expect(index).toContain("websiteEn.websiteTitle");
    expect(websiteEn.websiteTitle).toBe("Adelante Health — Whole-Person Care, Wherever You Are");
  });
});
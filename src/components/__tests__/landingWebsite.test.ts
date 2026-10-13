import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { websiteEn, websiteEs, WEBSITE_NAV } from "@/lib/i18n.website";

const landing = readFileSync("src/components/Landing.tsx", "utf8");
const shell = readFileSync("src/components/AppShell.tsx", "utf8");
const content = readFileSync("src/components/WebsiteContent.tsx", "utf8");
const layout = readFileSync("src/components/WebsiteLayout.tsx", "utf8");
const index = readFileSync("src/routes/index.tsx", "utf8");

describe("public website contract", () => {
  it("pins English Title Case headings without changing Spanish or navigation labels", () => {
    const headings = {
      websiteHow: ["How It Works", "Cómo funciona"],
      websiteFit: ["Find Where You Fit", "Encuentra tu lugar"],
      websiteWhat: ["What You Get", "Qué recibes"],
      websiteFaq: ["Frequently Asked Questions", "Preguntas frecuentes"],
      websiteAbout: ["About Us", "Sobre nosotros"],
      websitePartnersHeading: ["For Referral Partners", "Para organizaciones que refieren"],
      websiteTeam: ["Meet Our Team", "Conoce a nuestro equipo"],
      websiteCareTeam: ["Your Care Team", "Tu equipo de atención"],
      websiteNavigationTeam: ["Your Navigation and Reentry Team", "Tu equipo de orientación y reintegración"],
      websiteResourceTeam: ["Your Resource Team", "Tu equipo de recursos"],
      websiteAdvocateTeam: ["Your Advocate Support Team", "Tu equipo de apoyo para acompañantes"],
      websiteReady: ["Ready When You Are", "Listos cuando tú lo estés"],
    } as const;
    for (const key of Object.keys(headings) as Array<keyof typeof headings>) {
      expect(websiteEn[key]).toBe(headings[key][0]);
      expect(websiteEs[key]).toBe(headings[key][1]);
    }
    expect(WEBSITE_NAV.map(n => websiteEn[n.key])).toEqual(["How it works", "Find where you fit", "What you get", "FAQ", "About us", "Our team"]);
    expect([websiteEn.websiteAboutNav, websiteEn.websiteTeamNav, websiteEn.websitePartners, websiteEn.websiteFaqNav, websiteEn.websiteReferral]).toEqual(["About us", "Our team", "For partners", "FAQ", "Make a referral"]);
  });
  it("has a Spanish draft translation for every public string", () => {
    expect(Object.keys(websiteEs).sort()).toEqual(Object.keys(websiteEn).sort());
    for (const text of Object.values(websiteEs)) expect(text.length).toBeGreaterThan(0);
    expect(websiteEs.websiteDraft).toBe("ES Draft — pending translation review");
  });
  it("keeps Mitch's mission and closing copy verbatim", () => {
    expect(websiteEn.websiteMission).toBe("Adelante Health's Complete Wrap-Around Care provides whole-person, continuous care to anyone who needs it, wherever they are, bringing together mental and behavioral health, telepsychiatry, smart pathways to substance use recovery, and the everyday resources that make healing possible. As a hospital without walls, we serve every person with the same commitment, and we proudly pioneered care for people coming home from incarceration, walking alongside them and their advocates through the critical first 90 days and beyond so every fresh start becomes a lasting one.");
    expect(websiteEn.websiteReadyBody).toBe("Wherever you're starting from, we'll meet you there. Connect with our team to take your next step forward.");
  });
  it("pins the approved role, fit, language and general care copy", () => {
    const exact = {
      websiteCliniciansBody: "Help you work through stress, mental health concerns, and life's hardest moments.",
      websitePsychiatryBody: "Offer psychiatric care and medication support by video, from wherever you are.",
      websiteRecoveryBody: "Walk with you on your own path to substance use recovery, at your pace.",
      websiteCoordinatorsBody: "Keep every part of your care connected so nothing falls through the cracks.",
      websiteReentryBody: "Stand by you through your first 90 days home and beyond.",
      websiteResourcesBody: "Connect you with housing, food, transportation, and the everyday support that makes healing possible.",
      websiteAdvocatesBody: "Support the family members, friends, and mentors who walk alongside someone coming home.",
      websiteAnyoneBody: "Mental and behavioral health, telepsychiatry, substance use recovery, and everyday resources are open to you.",
      websiteComingHomeBody: "You can use every service above, plus a reentry guide for your first 90 days and beyond.",
      websiteLovedOnesBody: "You get guidance, resources, and a team that works with you, so you never have to support someone alone.",
      websiteTrustLanguage: "Available in English and Spanish.",
      websitePlanBody: "Meet your care team. Together you build a care plan around your goals.",
      websiteYourPlanBody: "A care plan built around your goals, in plain language.",
      websiteMindBody: "Support for stress, sleep, anger, sadness, and recovery.",
    };
    for (const [key, text] of Object.entries(exact)) expect(websiteEn[key as keyof typeof websiteEn]).toBe(text);
    expect(landing).not.toContain('t("websiteBrand")');
    for (const route of ["index", "about", "team"]) expect(readFileSync(`src/routes/${route}.tsx`, "utf8")).toContain("...websiteShareMeta");
  });
  it("orders sections and navigation and preserves the old anchor", () => {
    expect(WEBSITE_NAV.map((n) => [n.to, n.hash])).toEqual([["/", "how-it-works"], ["/", "find-your-fit"], ["/", "what-you-get"], ["/", "faq"], ["/about", undefined], ["/team", undefined]]);
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
    expect(websiteEn.websiteHeroHeading).toBe("Your Path Forward Starts Here.");
    expect(websiteEn.websiteHeroEyebrow).toBe("Care for anyone, wherever you are");
    for (const dict of [websiteEn, websiteEs]) for (const text of Object.values(dict)) {
      const nums = (text.match(/\d+/g) ?? []).filter((n) => !["988", "911", "90", "2", "42"].includes(n));
      expect(nums, text).toEqual([]);
    }
  });
});

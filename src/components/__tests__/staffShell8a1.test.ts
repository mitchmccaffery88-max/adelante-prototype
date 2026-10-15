// Phase 8a-1 — staff shell and density foundation (source contracts).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const shell = read("src/components/StaffShell.tsx");
const density = read("src/components/StaffDensity.tsx");
const demo = read("src/components/DemoControlsBar.tsx");
const app = read("src/components/AppShell.tsx");
const css = read("src/styles.css");

describe("8a-1 staff shell", () => {
  it("marks the shell compact and has no language toggle", () => {
    expect(shell).toContain('data-density="compact"');
    expect(shell).not.toMatch(/LanguageToggle|setLanguage/);
  });

  it("uses the 32px compact logo with the home label", () => {
    expect(shell).toContain('aria-label="Adelante home"');
    expect(shell).toContain("/brand/adelante-compact.svg");
    expect(shell).toContain("h-8");
  });

  it("counts only role-scoped open crisis rows and renders nothing at zero", () => {
    expect(shell).toContain("filterEscalations(listEscalations(actor)");
    expect(shell).toContain('r.type === "crisis" && r.status !== "resolved"');
    expect(shell).not.toContain("listCrisisEscalations");
    expect(shell).toContain("{count > 0 &&");
  });

  it("builds quick jump from the role-filtered nav registry", () => {
    expect(shell).toContain("useStaffNavGroups()");
  });

  it("keeps the launcher trigger in the member tree when no staff slot exists", () => {
    expect(density).toContain("if (target) return createPortal(children, target);");
    expect(density).toContain("return density ? null : children;");
  });

  for (const f of ["sheet", "dialog", "popover", "dropdown-menu", "select", "alert-dialog", "tooltip"]) {
    it(`marks staff-owned ${f} overlays via context only`, () => {
      expect(read(`src/components/ui/${f}.tsx`)).toContain("useStaffDensity()");
    });
  }

  for (const f of ["chart/ChartActionLauncher", "clinician/DashboardActionLauncher", "ops/OpsActionLauncher"]) {
    it(`${f} trigger goes through the shell New slot`, () => {
      expect(read(`src/components/${f}.tsx`)).toContain("StaffNewTrigger");
    });
  }

  it("demo controls use the neutral Simulated style for staff, never gold", () => {
    expect(demo).toContain("border-dashed");
    expect(demo).toContain("FlaskConical");
    expect(demo).toContain('staff ? "staff-demo-controls border-line-strong"');
  });

  it("provider reference joins the shell only via its existing access rule", () => {
    expect(app).toContain("canReadProviderRef");
    expect(app).not.toMatch(/["']\/consent["']\s*[,\]].*isStaff/);
  });

  it("scopes the compact density rules to staff hosts", () => {
    expect(css).toContain('[data-density="compact"]');
  });
});

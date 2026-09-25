import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const shell = readFileSync("src/components/AppShell.tsx", "utf8");
const drawer = readFileSync("src/components/UserNavigationDrawer.tsx", "utf8");
const demoBar = readFileSync("src/components/DemoControlsBar.tsx", "utf8");
const switcher = readFileSync("src/components/DemoStateSwitcher.tsx", "utf8");

describe("patient and advocate navigation correction", () => {
  it("uses persistent sidebars on desktop and one left drawer on phones", () => {
    expect(shell).toContain("<PatientSidebar />");
    expect(shell).toContain("<AdvocateSidebar />");
    expect(shell).toContain('<UserNavigationDrawer mode="patient" />');
    expect(shell).toContain('<UserNavigationDrawer mode="advocate" />');
    expect(drawer).toContain('side="left"');
  });

  it("keeps staff navigation off patient and advocate pages", () => {
    expect(shell).toContain("{isStaffSurface && <DropdownMenu>");
    expect(shell).toContain("{isStaffSurface && (");
  });

  it("keeps demo controls sticky and prompts before scenario selection", () => {
    expect(demoBar).toContain('className="sticky top-0');
    expect(switcher).toContain('"choose a scenario"');
  });
});
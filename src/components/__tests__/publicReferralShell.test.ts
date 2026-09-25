import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const appShell = readFileSync("src/components/AppShell.tsx", "utf8");

describe("public referral shell", () => {
  it("gives public classification precedence over staff routes", () => {
    expect(appShell).toMatch(/!isPublicSurface\s*&&\s*!isAdvocateSurface/);
  });

  it("does not mount staff-only controls on public pages", () => {
    expect(appShell).toContain("{!isPublicSurface && <RouteAccessGuard />}");
    expect(appShell).toContain("{!isPublicSurface && !onboarding && <NotificationBell />}");
    expect(appShell).toContain("{!isPublicSurface && !onboarding && <DropdownMenu>");
  });

  it("mounts the demo controls bar on every page type, public included (Part C)", () => {
    expect(appShell).toContain("      <DemoControlsBar />");
  });
});
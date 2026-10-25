// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WebsiteNavigation } from "../WebsiteNavigation";
import { WebsiteLayout } from "../WebsiteLayout";
import { DAYLIGHT_PUBLIC_ROUTES } from "@/lib/websiteMenus";
import { websiteEn } from "@/lib/i18n.website";
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang:"en",setLang:vi.fn(),t:(key: keyof typeof websiteEn) => websiteEn[key] }) }));
vi.mock("@/lib/earlyTap", () => ({useEarlyTapReplay:vi.fn()}));
vi.mock("../DemoControlsBar", () => ({DemoControlsBar:() => <div data-testid="demo-controls-bar" />}));
vi.mock("@tanstack/react-router", () => ({
 useRouterState: () => "/",
 Link: ({ to,hash,hashScrollIntoView,children,...props }: any) => <a href={to+(hash ? `#${hash}` : "")} {...props}>{children}</a>,
}));
beforeAll(() => {
 vi.stubGlobal("ResizeObserver",class { observe(){} disconnect(){} });
 vi.stubGlobal("IntersectionObserver",class { observe(){} disconnect(){} });
});
afterEach(cleanup);
describe("Daylight public menu interaction",() => {
 it("opens by click and Escape restores focus to the exact desktop trigger", async () => {
  const user=userEvent.setup(); render(<WebsiteNavigation />);
  const trigger=screen.getByRole("button",{name:"Get care"});
  await user.click(trigger); expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await user.keyboard("{Escape}"); expect(trigger.getAttribute("aria-expanded")).toBe("false"); expect(document.activeElement).toBe(trigger);
 });
 it("allows only one desktop panel, does not open on hover, and closes outside", async () => {
  const user=userEvent.setup(); render(<WebsiteNavigation />);
  const care=screen.getByRole("button",{name:"Get care"}); const team=screen.getByRole("button",{name:"Our team"});
  await user.hover(care); expect(care.getAttribute("aria-expanded")).toBe("false");
  await user.click(care); await user.click(team);
  expect(care.getAttribute("aria-expanded")).toBe("false"); expect(team.getAttribute("aria-expanded")).toBe("true");
  fireEvent.pointerDown(document.body); expect(team.getAttribute("aria-expanded")).toBe("false");
 });
 it("traps phone sheet focus, closes on Escape, and restores its opener", async () => {
  const user=userEvent.setup(); render(<WebsiteNavigation mobile />);
  const opener=screen.getByRole("button",{name:"Open website menu"}); await user.click(opener);
  const sheet=screen.getByRole("dialog"); const close=screen.getByRole("button",{name:"Close menu"});
  await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
  close.focus(); await user.keyboard("{Shift>}{Tab}{/Shift}"); expect(sheet.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Tab}"); expect(sheet.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}"); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(opener));
 });
});
describe("public crisis coverage",() => {
 for (const route of ["/","/about","/team","/auth","/referral","/start","/start/signup","/start/helping","/start/support","/start/reconnect","/start/other-help",...DAYLIGHT_PUBLIC_ROUTES]) {
  it(`keeps one 988 aside in the shared shell for ${route}`,() => {
   render(<WebsiteLayout><div>{route}</div></WebsiteLayout>);
   const aside=screen.getByRole("complementary",{name:"Crisis support"});
   expect(aside.querySelector('a[href="tel:988"]')?.textContent).toBe("988");
   expect(screen.getAllByRole("main")).toHaveLength(1);
  });
 }
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const navigate = vi.fn();
let pathname = "/admin";
let role = "peer_specialist";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname } }),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));
vi.mock("@/lib/roles", async () => {
  const actual = await vi.importActual<typeof import("@/lib/roles")>("@/lib/roles");
  return { ...actual, useActingStaff: () => ({ role, staffId: "s", staffName: "S" }) };
});

import { RouteAccessGuard } from "../RouteAccessGuard";

describe("RouteAccessGuard", () => {
  beforeEach(() => {
    navigate.mockClear();
    toastError.mockClear();
    vi.useRealTimers();
  });

  it("redirects and toasts on a gated deep link", async () => {
    pathname = "/admin";
    role = "peer_specialist";
    render(<RouteAccessGuard />);
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(navigate.mock.calls[0][0]).toMatchObject({ replace: true });
    expect(navigate.mock.calls[0][0].to).not.toBe("/admin");
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toBe("Access restricted");
  });

  it("stays put when the role clears the gate", async () => {
    pathname = "/admin";
    role = "sys_admin";
    render(<RouteAccessGuard />);
    await new Promise((r) => setTimeout(r, 20));
    expect(navigate).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("ignores routes outside the nav registry", async () => {
    pathname = "/record/p1";
    role = "peer_specialist";
    render(<RouteAccessGuard />);
    await new Promise((r) => setTimeout(r, 20));
    expect(navigate).not.toHaveBeenCalled();
  });
});
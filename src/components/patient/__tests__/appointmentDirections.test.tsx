// @vitest-environment jsdom
// §Small UI gaps batch item 5 — in-person appointments get an honest
// Directions action: a maps SEARCH on the real location address, never a
// fabricated coordinate. No seeded appointment in the demo data is in-person,
// so this books a real one through the real booking API.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRootRoute, createRouter, createMemoryHistory, RouterProvider, Outlet } from "@tanstack/react-router";
import { AdelanteEHR } from "@/lib/ehr";
import { AppointmentsSummary } from "@/components/patient/AppointmentsSummary";

function renderWithRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <>{ui}<Outlet /></> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return render(<RouterProvider router={router as any} />);
}

describe("appointment directions", () => {
  it("renders a maps search link for a real in-person location", async () => {
    const patientId = "p1";
    const location = AdelanteEHR.listLocations()[0]!;
    const clinician = AdelanteEHR.cliniciansForService()[0]!;
    AdelanteEHR.bookAppointment({
      patientId,
      clinicianId: clinician.id,
      start: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      durationMin: 30,
      modality: "in_person",
      locationId: location.id,
    });

    renderWithRouter(<AppointmentsSummary patientId={patientId} />);

    const link = await screen.findByTestId("appt-directions");
    const href = link.closest("a")?.getAttribute("href") ?? link.getAttribute("href") ?? "";
    expect(href).toContain("https://www.google.com/maps/search/?api=1&query=");
    expect(href).toContain(encodeURIComponent(location.address).slice(0, 12));
  });
});

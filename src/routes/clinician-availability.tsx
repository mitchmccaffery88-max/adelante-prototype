import { createFileRoute, redirect } from "@tanstack/react-router";

// §Calendars — availability moved into "My calendar" (same data, one model).
export const Route = createFileRoute("/clinician-availability")({
  beforeLoad: () => {
    throw redirect({ to: "/my-calendar" });
  },
});

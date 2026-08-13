import { createFileRoute } from "@tanstack/react-router";
import { PatientHome } from "@/components/PatientHome";

export const Route = createFileRoute("/patient")({
  // The acting patient is a CLIENT-ONLY session (restored from localStorage
  // after mount), so any server render is guaranteed to describe a different
  // person than the client. Rendering this shell on the client only removes
  // that hydration mismatch at the source instead of papering over it.
  ssr: false,
  head: () => ({
    meta: [
      { title: "My care — Adelante" },
      { name: "description", content: "Your care plan, appointments, and intake." },
    ],
  }),
  component: PatientHome,
});

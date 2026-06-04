import { createFileRoute } from "@tanstack/react-router";
import { PatientHome } from "@/components/PatientHome";

export const Route = createFileRoute("/patient")({
  head: () => ({
    meta: [
      { title: "My care — Adelante" },
      { name: "description", content: "Your care plan, appointments, and intake." },
    ],
  }),
  component: PatientHome,
});

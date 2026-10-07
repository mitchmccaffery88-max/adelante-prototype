import { createFileRoute } from "@tanstack/react-router";
import { CoverageAtReleasePanel } from "@/components/coverage/CoverageAtReleasePanel";

export const Route = createFileRoute("/coverage-release")({
  head: () => ({
    meta: [
      { title: "Coverage at release — Adelante" },
      { name: "description", content: "Medi-Cal pre-release and reactivation tracker for everyone with a release date." },
      { property: "og:title", content: "Coverage at release — Adelante" },
      { property: "og:description", content: "Medi-Cal pre-release and reactivation tracker." },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <h1 className="font-display text-2xl text-navy">Coverage at release</h1>
      <CoverageAtReleasePanel />
    </div>
  ),
});

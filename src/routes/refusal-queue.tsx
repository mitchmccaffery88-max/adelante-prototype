import { createFileRoute } from "@tanstack/react-router";
import { FileSignature, Lock } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { NurseRefusalWorklist } from "@/components/clinical/refusal/NurseRefusalWorklist";
import { canAccess, useActingStaff } from "@/lib/roles";

export const Route = createFileRoute("/refusal-queue")({
  head: () => ({
    meta: [
      { title: "Refusal Documents — Adelante" },
      {
        name: "description",
        content: "Medication-refusal documents awaiting staff signature and escalation review.",
      },
      { property: "og:title", content: "Refusal Documents — Adelante" },
      {
        property: "og:description",
        content: "Medication-refusal documents awaiting staff signature and escalation review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefusalQueuePage,
});

function RefusalQueuePage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "meds_erx");

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState
          icon={Lock}
          title="Refusal documents are restricted"
          description={access.reason ?? "Your role cannot open medication-refusal documents."}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <header>
        <div className="flex items-center gap-2 text-xs font-medium uppercase text-teal">
          <FileSignature className="h-4 w-4" /> Queues
        </div>
        <h1 className="mt-1 font-display text-2xl text-navy">Refusal documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and sign the separate legal documents created from medication refusals.
        </p>
      </header>
      <NurseRefusalWorklist staffName={staffName} readOnly={access.level === "read"} />
    </div>
  );
}
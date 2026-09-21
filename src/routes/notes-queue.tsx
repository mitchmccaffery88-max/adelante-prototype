// §EHR audit Phase 1a — the UNSCOPED (whole-clinic) view of unsigned
// documentation. Same derivation as the Inbox Unsigned tab and the /clinician
// tile (`listUnsignedWork`), just without the author filter.
//
// Two real kinds are shown explicitly rather than merged:
//   • draft note      — something is written and can be signed
//   • no note yet     — an attended visit with nothing drafted; there is
//                       nothing to sign, so the action is "open chart"
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { listUnsignedWork } from "@/lib/unsignedWork";
import { noteSignAuthorization } from "@/lib/notes";
import { signUnsignedWorkRow } from "@/lib/noteSignFlow";
import { canAccess, useActingStaff } from "@/lib/roles";
import { ClientDate } from "@/components/ClientDate";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/notes-queue")({
  head: () => ({
    meta: [
      { title: "Unsigned Notes — Adelante" },
      { name: "description", content: "Sign completed encounter notes to release billing." },
    ],
  }),
  component: NotesQueuePage,
});

function ageBadge(days: number) {
  if (days <= 2) return "bg-muted text-muted-foreground";
  if (days <= 6) return "bg-gold/20 text-navy";
  return "bg-destructive/15 text-destructive";
}

function NotesQueuePage() {
  const actor = useActingStaff();
  const access = canAccess(actor.role, "therapy_notes");
  const rows = useEhr(() => listUnsignedWork());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="p-6 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="h-4 w-4" /> Your role can&apos;t view clinical notes.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Unsigned notes</h1>
          <p className="text-sm text-muted-foreground">
            Everyone&apos;s unfinished documentation. Signing releases the claim. Your own work is
            also in your inbox.
          </p>
        </div>
        <Link to="/clinician" className="text-sm underline">← Clinician</Link>
      </header>

      <Card className="p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All caught up. Every attended encounter is documented and signed.
          </p>
        ) : (
          <ul className="divide-y" data-testid="notes-queue-rows">
            {rows.map((row) => {
              const cl = clinicians.find((c) => c.id === row.authorId);
              const auth = row.note ? noteSignAuthorization(row.note, actor) : null;
              return (
                <li key={row.id} className="py-3 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {row.patient.firstName} {row.patient.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <ClientDate value={row.date} /> · {cl?.name ?? row.authorId}
                      {row.appointment?.serviceType ? ` · ${row.appointment.serviceType}` : ""}
                    </div>
                    {row.kind === "undocumented_encounter" && (
                      <div className="text-xs text-muted-foreground">
                        No note written yet — nothing to sign.
                      </div>
                    )}
                    {auth && !auth.allowed && (
                      <div className="text-xs text-muted-foreground">{auth.reason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={ageBadge(row.ageDays)}>{row.ageDays}d</Badge>
                    {row.kind === "draft_note" && auth?.allowed ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          const res = signUnsignedWorkRow(row, actor);
                          if (!res.ok) toast.error(res.error ?? "Could not sign this note.");
                          else if (res.routedToCosign)
                            toast.success("Signed · routed for cosignature");
                          else toast.success("Note signed · claim released to billing");
                        }}
                      >
                        {auth.asSupervisor ? "Sign as supervisor" : "Sign"}
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/record/$patientId"
                          params={{ patientId: row.patient.id }}
                          search={{ section: "notes" }}
                        >
                          Open chart
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

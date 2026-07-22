import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";
import { ClientDate } from "@/components/ClientDate";

export const Route = createFileRoute("/notes-queue")({
  head: () => ({
    meta: [
      { title: "Unsigned Notes — Adelante" },
      { name: "description", content: "Sign completed encounter notes to release billing." },
    ],
  }),
  component: NotesQueuePage,
});

function ageBucket(startISO: string) {
  const days = Math.floor((Date.now() - +new Date(startISO)) / 86400_000);
  if (days <= 2) return { label: `${days}d`, style: "bg-muted text-muted-foreground" };
  if (days <= 6) return { label: `${days}d`, style: "bg-gold/20 text-navy" };
  return { label: `${days}d`, style: "bg-destructive/15 text-destructive" };
}

function NotesQueuePage() {
  const unsigned = useEhrExt(() => AdelanteEHRExt.listUnsignedCompletedAppts());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Unsigned notes</h1>
          <p className="text-sm text-muted-foreground">
            Completed visits waiting for your signature. Signing releases the claim.
          </p>
        </div>
        <Link to="/clinician" className="text-sm underline">← Clinician</Link>
      </header>

      <Card className="p-4">
        {unsigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">All caught up. Every completed encounter is signed.</p>
        ) : (
          <ul className="divide-y">
            {unsigned.map((a) => {
              const pt = patients.find((p) => p.id === a.patientId);
              const cl = clinicians.find((c) => c.id === a.clinicianId);
              const age = ageBucket(a.start);
              return (
                <li key={a.id} className="py-3 flex items-center justify-between gap-2 text-sm">
                  <div>
                    <div className="font-medium">{pt?.firstName} {pt?.lastName}</div>
                    <div className="text-xs text-muted-foreground">
                      <ClientDate value={a.start} /> · {cl?.name} · {a.serviceType ?? "visit"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={age.style}>{age.label}</Badge>
                    <Button
                      size="sm"
                      onClick={() => {
                        AdelanteEHRExt.signNote(a.id, a.clinicianId);
                        toast.success("Note signed · claim released to billing");
                      }}
                    >
                      Sign
                    </Button>
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
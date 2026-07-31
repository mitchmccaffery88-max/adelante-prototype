// §Messaging Phase 2 — cross-patient message queue.
//
// Same shape as the cosign inbox and crisis queue: patients with unread
// patient-authored messages, oldest-unread first, click into the thread.
// In-app only — there is no email/SMS/push transport in this build, so an
// unanswered message is only seen when a staff member opens this page.
import { createFileRoute, Link } from "@tanstack/react-router";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Lock, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/message-queue")({
  head: () => ({
    meta: [
      { title: "Message queue — Adelante" },
      {
        name: "description",
        content:
          "Cross-patient queue of unanswered patient messages, oldest-unread first, linking into each care-team thread.",
      },
      { property: "og:title", content: "Message queue — Adelante" },
      {
        property: "og:description",
        content: "Answer patient messages, longest-waiting first.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessageQueuePage,
});

function MessageQueuePage() {
  const { role } = useActingStaff();
  const access = canAccess(role, "patient_messaging");
  const rows = useEhr(() => AdelanteEHR.listUnreadMessageThreads());

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/clinician">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </Button>
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl text-navy">
          <MessageSquare className="h-5 w-5 text-teal" /> Message queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Patients waiting on a reply, longest-waiting first. Asynchronous by design — patients are
          told replies are not immediate.
        </p>
      </header>

      {access.locked ? (
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          Your role does not have access to patient messaging.
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No unanswered patient messages" />
      ) : (
        <ul className="space-y-2">
          {rows.map(({ patient, unread, oldestUnreadAt, latest }) => (
            <Card key={patient.id} className="space-y-1.5 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to="/record/$patientId"
                  params={{ patientId: patient.id }}
                  search={{ section: "messages" }}
                  className="font-display text-base text-navy underline-offset-2 hover:underline"
                >
                  {patient.firstName} {patient.lastName}
                </Link>
                <Badge className="border-0 bg-teal/15 text-[10px] text-teal">
                  {unread} unread
                </Badge>
              </div>
              <p className="line-clamp-2 whitespace-pre-wrap text-navy">{latest.body}</p>
              <p className="text-muted-foreground">
                Waiting since <ClientDate value={oldestUnreadAt} /> · last message from{" "}
                {latest.authorName}
              </p>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}

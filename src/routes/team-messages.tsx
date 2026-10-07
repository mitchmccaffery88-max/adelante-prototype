// §U2 — Messages → Team: staff-to-staff threads. Staff shell only.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { useActingStaff } from "@/lib/roles";
import { canMessageStaff } from "@/lib/staffThreads";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { NewThreadForm, ThreadList, ThreadView } from "@/components/team/TeamThreads";
import { MessagesTabs } from "@/components/team/MessagesTabs";

export const Route = createFileRoute("/team-messages")({
  validateSearch: (s: Record<string, unknown>) => ({ thread: typeof s["thread"] === "string" ? (s["thread"] as string) : undefined }),
  head: () => ({
    meta: [
      { title: "Team messages — Adelante" },
      { name: "description", content: "Staff-to-staff care team and direct threads, with mentions and read receipts." },
      { property: "og:title", content: "Team messages — Adelante" },
      { property: "og:description", content: "Talk with the care team without leaving the record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamMessagesPage,
});

function TeamMessagesPage() {
  const { role } = useActingStaff();
  const { thread } = Route.useSearch();
  const [composing, setComposing] = useState(false);
  if (!canMessageStaff(role)) return <div className="mx-auto max-w-5xl p-4"><EmptyState icon={MessageSquare} title="Team messaging isn't part of your role" /></div>;
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-2xl text-navy"><MessageSquare className="h-5 w-5" /> Messages</h1>
        <MessagesTabs active="team" />
      </header>
      <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b p-2"><Button size="sm" variant="outline" onClick={() => setComposing((v) => !v)}><Plus className="h-4 w-4" /> New direct thread</Button></div>
          {composing && <div className="border-b p-3"><NewThreadForm onDone={() => setComposing(false)} /></div>}
          <ThreadList selected={thread} />
        </Card>
        <Card className="p-4">{thread ? <ThreadView threadId={thread} /> : <p className="text-sm text-muted-foreground">Choose a thread. Patient threads start from a chart, “+ New → Message team”, or “Discuss” on an escalation.</p>}</Card>
      </div>
    </div>
  );
}

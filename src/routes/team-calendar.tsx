import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useActingStaff } from "@/lib/roles";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useEhrExt } from "@/lib/ehr-ext";
import { act } from "@/lib/actions/act";
import { authorOutItems, AUTHOR_OUT_LABEL } from "@/lib/noteClock";
import { canManageStaffCalendars, listRescheduleItems, teamOutThisWeek } from "@/lib/workingCalendar";

export const Route = createFileRoute("/team-calendar")({
  head: () => ({
    meta: [
      { title: "Team calendar — Adelante" },
      { name: "description", content: "Who's out this week by site, authors out with notes waiting, and visits to reschedule." },
      { property: "og:title", content: "Team calendar — Adelante" },
      { property: "og:description", content: "Who's out this week by site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamCalendarPage,
});

function TeamCalendarPage() {
  const me = useActingStaff();
  const actor = { role: me.role, staffId: me.staffId, clinicianId: me.clinicianId };
  const week = useEhrExt(() => teamOutThisWeek(actor));
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const authors = useEhrExt(() => authorOutItems(patients));
  const resched = useEhrExt(() => listRescheduleItems("open"));
  if (!canManageStaffCalendars(me.role)) return <div className="p-6 text-sm text-muted-foreground">Team calendar isn't available for your role.</div>;
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="font-display text-2xl text-navy">Team calendar</h1>
      {authors.length > 0 && (
        <Card className="space-y-2 p-4" data-testid="author-out-list">
          <h2 className="font-semibold">{AUTHOR_OUT_LABEL}</h2>
          {authors.map((a) => <div key={a.authorId} className="text-sm">{a.authorName} · {a.openNotes} open note(s) · out {a.outFrom}{a.outTo !== a.outFrom ? ` – ${a.outTo}` : ""} — reassign or arrange a cosigner.</div>)}
        </Card>
      )}
      {resched.length > 0 && (
        <Card className="space-y-2 p-4" data-testid="reschedule-list">
          <h2 className="font-semibold">Reschedule needed</h2>
          <p className="text-xs text-muted-foreground">Nothing was cancelled and no patient was notified.</p>
          {resched.map((r) => {
            const p = patients.find((x) => x.id === r.patientId);
            return <div key={r.id} className="flex items-center justify-between text-sm"><span>{p ? `${p.firstName} ${p.lastName}` : "Patient"} · {new Date(r.start).toLocaleString()} · {r.cause === "site_closed" ? "clinic closed" : "clinician out"}</span><Button size="sm" variant="outline" onClick={() => { try { act("calendar_reschedule_done", "markRescheduleHandled", actor, { itemId: r.id }); toast.success("Marked handled"); } catch (e) { toast.error((e as Error).message); } }}>Mark handled</Button></div>;
          })}
        </Card>
      )}
      {week.bySite.length === 0 ? <Card className="p-4 text-sm text-muted-foreground">Nobody is out this week.</Card> : week.bySite.map((s) => (
        <Card key={s.siteId} className="overflow-x-auto p-4" data-testid="team-out-site">
          <h2 className="mb-2 font-semibold">{s.siteName}</h2>
          <table className="w-full text-sm">
            <thead><tr><th className="text-left">Staff</th>{week.days.map((d) => <th key={d} className="text-left font-normal text-muted-foreground">{new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric", timeZone: "UTC" })}</th>)}</tr></thead>
            <tbody>{s.people.map((p) => <tr key={p.ownerId}><td>{p.name}</td>{p.days.map((d) => <td key={d.date}>{d.out ? <Badge variant="outline">{d.label}</Badge> : ""}</td>)}</tr>)}</tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

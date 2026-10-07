import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useActingStaff } from "@/lib/roles";
import { useEhrExt } from "@/lib/ehr-ext";
import { act } from "@/lib/actions/act";
import { canEditSiteCalendar, canReadSiteCalendar, HOLIDAY_DRAFT_LABEL, listSiteCalendars, nextClosedDays } from "@/lib/workingCalendar";

export const Route = createFileRoute("/location-calendars")({
  head: () => ({
    meta: [
      { title: "Location calendars — Adelante" },
      { name: "description", content: "Clinic open hours, holidays and closures per site." },
      { property: "og:title", content: "Location calendars — Adelante" },
      { property: "og:description", content: "Clinic open hours, holidays and closures per site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LocationCalendarsPage,
});
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function LocationCalendarsPage() {
  const me = useActingStaff();
  const actor = { role: me.role, staffId: me.staffId };
  const rows = useEhrExt(() => listSiteCalendars());
  const [openSite, setOpenSite] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", name: "", reason: "" });
  if (!canReadSiteCalendar(me.role)) return <div className="p-6 text-sm text-muted-foreground">Location calendars aren't available for your role.</div>;
  const edit = canEditSiteCalendar(me.role);
  const current = rows.find((r) => r.site.id === openSite);
  const run = (id: string, via: string, arg: unknown, msg: string) => {
    try { act(id, via, actor, arg); toast.success(msg); return true; } catch (e) { toast.error((e as Error).message); return false; }
  };
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header>
        <h1 className="font-display text-2xl text-navy">Location calendars</h1>
        <p className="text-sm text-muted-foreground">Working days for notes and booking follow each site's calendar. {edit ? "" : "Read only."}</p>
      </header>
      {rows.map(({ site, calendar }) => (
        <Card key={site.id} className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid="site-calendar-row">
          <div className="min-w-0">
            <div className="font-medium text-navy">{site.name}</div>
            {calendar ? (
              <div className="text-xs text-muted-foreground">
                {calendar.timezone} · open {calendar.openHours.map((h) => DAYS[h.weekday]).join(", ")} · next closed: {nextClosedDays(site.id, 3).map((d) => `${d.date} ${d.name}`).join(" · ") || "none"}
              </div>
            ) : <div className="text-xs text-muted-foreground">No calendar yet — copies the org default holiday list.</div>}
          </div>
          {calendar ? <Button size="sm" variant="outline" onClick={() => setOpenSite(site.id)}>Closed days</Button>
            : edit && <Button size="sm" onClick={() => run("calendar_site_create", "createSiteCalendarFromDefaults", { siteId: site.id, reason: "New site calendar from org defaults" }, "Calendar created")}>Create from defaults</Button>}
        </Card>
      ))}
      <Sheet open={!!current} onOpenChange={(o) => !o && setOpenSite(null)}>
        <SheetContent side="right" className="w-full space-y-3 overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{current?.site.name} — closed days</SheetTitle></SheetHeader>
          <Badge variant="outline">{HOLIDAY_DRAFT_LABEL}</Badge>
          {edit && current && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="text-sm font-medium">Add a one-off closure</div>
              <Label htmlFor="cd-date">Date</Label><Input id="cd-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <Label htmlFor="cd-name">Name</Label><Input id="cd-name" placeholder="e.g. Staff training day" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Label htmlFor="cd-reason">Reason</Label><Input id="cd-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              <Button className="w-full" onClick={() => {
                try {
                  const r = act<{ reschedule: unknown[] }>("calendar_site_closed_add", "addSiteClosedDay", actor, { siteId: current.site.id, ...form });
                  toast.success(r.reschedule.length ? `Closed day added — ${r.reschedule.length} visit(s) need rescheduling (coordinator notified)` : "Closed day added");
                  setForm({ date: "", name: "", reason: "" });
                } catch (e) { toast.error((e as Error).message); }
              }}>Add closed day</Button>
            </div>
          )}
          <ul className="divide-y text-sm">
            {current?.calendar?.closedDays.filter((d) => !d.removedAt && d.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.date.localeCompare(b.date)).map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2" data-testid="closed-day-row">
                <span>{d.date} · {d.name} {d.kind === "closure" && <Badge variant="outline" className="ml-1">Closure</Badge>}</span>
                {edit && <Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt("Reason for removing this closed day?"); if (reason) run("calendar_site_closed_remove", "removeSiteClosedDay", { siteId: current.site.id, closedDayId: d.id, reason }, "Closed day removed"); }}>Remove</Button>}
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

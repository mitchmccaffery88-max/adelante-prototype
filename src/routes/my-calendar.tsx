import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAFF_ROSTER, useActingStaff } from "@/lib/roles";
import { AdelanteEHRExt, useEhrExt, type AvailabilityBlock, type TimeOffType } from "@/lib/ehr-ext";
import { act } from "@/lib/actions/act";
import { CalendarSyncCard } from "@/components/calendar/CalendarSyncCard";
import { calendarOwnerFor, canManageStaffCalendars, listSiteCalendars, siteForBlock, siteName, timeOffView, TIME_OFF_LABEL } from "@/lib/workingCalendar";

export const Route = createFileRoute("/my-calendar")({
  head: () => ({
    meta: [
      { title: "My calendar — Adelante" },
      { name: "description", content: "Your working hours per site and your time off." },
      { property: "og:title", content: "My calendar — Adelante" },
      { property: "og:description", content: "Your working hours per site and your time off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyCalendarPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MyCalendarPage() {
  const me = useActingStaff();
  const manager = canManageStaffCalendars(me.role);
  const myOwner = calendarOwnerFor(me.staffId) ?? me.staffId;
  const [picked, setPicked] = useState<string | null>(null);
  const owner = manager && picked ? picked : myOwner;
  const actor = { role: me.role, staffId: me.staffId, clinicianId: me.clinicianId };
  const blocks = useEhrExt(() => AdelanteEHRExt.availabilityBlocksForClinician(owner));
  const off = useEhrExt(() => timeOffView(actor, owner));
  const sites = listSiteCalendars().filter((s) => s.calendar);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [offOpen, setOffOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<AvailabilityBlock, "id" | "clinicianId">>({ weekday: 1, start: "09:00", end: "17:00", modality: "hybrid", siteId: sites[0]?.site.id, careTypes: [] });
  const [t, setT] = useState<{ start: string; end: string; type: TimeOffType; note: string }>({ start: "", end: "", type: "vacation", note: "" });
  const run = (id: string, via: string, arg: unknown, msg: string) => {
    try { act(id, via, actor, arg); toast.success(msg); return true; } catch (e) { toast.error((e as Error).message); return false; }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl text-navy">My calendar</h1>
          <p className="text-sm text-muted-foreground">Working hours per site and time off. Booking and your note-signing clock follow this.</p>
        </div>
        {manager && (
          <Select value={owner} onValueChange={setPicked}>
            <SelectTrigger className="w-60" aria-label="Whose calendar"><SelectValue /></SelectTrigger>
            <SelectContent>{STAFF_ROSTER.map((s) => <SelectItem key={s.id} value={s.clinicianId ?? s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </header>

      <Card className="space-y-3 p-4" data-testid="hours-grid">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Working hours</h2><Button size="sm" variant="outline" onClick={() => setHoursOpen(true)}>Add hours</Button></div>
        <div className="grid grid-cols-5 gap-2 text-xs">
          {[1, 2, 3, 4, 5].map((wd) => (
            <div key={wd} className="rounded-md border p-2">
              <div className="font-medium">{DAYS[wd]}</div>
              {blocks.filter((b) => b.weekday === wd).length === 0 ? <div className="text-muted-foreground">—</div> : blocks.filter((b) => b.weekday === wd).map((b) => (
                <div key={b.id} className="mt-1 flex items-start justify-between gap-1">
                  <span>{b.start}–{b.end}<br /><span className="text-muted-foreground">{siteName(siteForBlock(b))}{b.modality === "virtual" ? " · telehealth" : ""}</span></span>
                  <button className="text-muted-foreground underline" onClick={() => run("calendar_staff_hours_remove", "removeStaffHours", { ownerId: owner, blockId: b.id, reason: "Hours removed" }, "Hours removed")} aria-label="Remove hours">×</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-4" data-testid="time-off">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Time off</h2><Button size="sm" onClick={() => setOffOpen(true)}>Enter time off</Button></div>
        {off.length === 0 ? <p className="text-sm text-muted-foreground">No time off entered.</p> : (
          <ul className="divide-y text-sm">
            {off.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2" data-testid="time-off-row">
                <span>{o.date}{o.endDate !== o.date ? ` – ${o.endDate}` : ""} <Badge variant="outline" className="ml-1">{o.label}</Badge></span>
                <Button size="sm" variant="ghost" onClick={() => run("calendar_time_off_remove", "removeTimeOff", { ownerId: owner, timeOffId: o.id }, "Time off withdrawn")}>Withdraw</Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Other staff see only "Out" — never the type.</p>
      </Card>

      <CalendarSyncCard key={owner} ownerId={owner} actor={actor} />

      <Sheet open={hoursOpen} onOpenChange={setHoursOpen}>
        <SheetContent side="right" className="space-y-3">
          <SheetHeader><SheetTitle>Add working hours</SheetTitle></SheetHeader>
          <Label>Day</Label>
          <Select value={String(draft.weekday)} onValueChange={(v) => setDraft({ ...draft, weekday: Number(v) as AvailabilityBlock["weekday"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 0].map((d) => <SelectItem key={d} value={String(d)}>{DAYS[d]}</SelectItem>)}</SelectContent></Select>
          <div className="grid grid-cols-2 gap-2"><div><Label>Start</Label><Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></div><div><Label>End</Label><Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></div></div>
          <Label>Site (telehealth: the site you bill under)</Label>
          <Select value={draft.siteId} onValueChange={(v) => setDraft({ ...draft, siteId: v })}><SelectTrigger><SelectValue placeholder="Pick a site" /></SelectTrigger><SelectContent>{sites.map((s) => <SelectItem key={s.site.id} value={s.site.id}>{s.site.name}</SelectItem>)}</SelectContent></Select>
          <Label>Type</Label>
          <Select value={draft.modality} onValueChange={(v) => setDraft({ ...draft, modality: v as AvailabilityBlock["modality"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_person">In person</SelectItem><SelectItem value="virtual">Telehealth</SelectItem><SelectItem value="hybrid">Both</SelectItem></SelectContent></Select>
          <Button className="w-full" onClick={() => run("calendar_staff_hours_save", "saveStaffHours", { ...draft, clinicianId: owner, reason: "Working hours added" }, "Hours saved") && setHoursOpen(false)}>Save hours</Button>
        </SheetContent>
      </Sheet>

      <Sheet open={offOpen} onOpenChange={setOffOpen}>
        <SheetContent side="right" className="space-y-3">
          <SheetHeader><SheetTitle>Enter time off</SheetTitle></SheetHeader>
          <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="off-start">First day</Label><Input id="off-start" type="date" value={t.start} onChange={(e) => setT({ ...t, start: e.target.value })} /></div><div><Label htmlFor="off-end">Last day</Label><Input id="off-end" type="date" value={t.end} onChange={(e) => setT({ ...t, end: e.target.value })} /></div></div>
          <Label>Type (private)</Label>
          <Select value={t.type} onValueChange={(v) => setT({ ...t, type: v as TimeOffType })}><SelectTrigger aria-label="Time off type"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(TIME_OFF_LABEL) as TimeOffType[]).map((k) => <SelectItem key={k} value={k}>{TIME_OFF_LABEL[k]}</SelectItem>)}</SelectContent></Select>
          <Button className="w-full" onClick={() => run("calendar_time_off_add", "addTimeOff", { ownerId: owner, start: t.start, end: t.end || t.start, type: t.type }, "Time off saved") && setOffOpen(false)}>Save time off</Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

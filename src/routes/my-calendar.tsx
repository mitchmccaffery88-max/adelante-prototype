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
import { availabilityPageTitle, blockNeedsCareTypes, bookingsFrozen, canEditSiteServices, careTagLabel, effectiveBlockTags, hourSitesFor, isBookableRole, listCareTags, siteServices } from "@/lib/staffProfile";
import { calendarOwnerFor, canManageStaffCalendars, listSiteCalendars, siteForBlock, siteName, timeOffView, TIME_OFF_LABEL } from "@/lib/workingCalendar";

export const Route = createFileRoute("/my-calendar")({
  head: () => ({
    meta: [
      { title: "My availability — Adelante" },
      { name: "description", content: "Your working hours per site and your time off." },
      { property: "og:title", content: "My availability — Adelante" },
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
  const ownerMember = STAFF_ROSTER.find((s) => (s.clinicianId ?? s.id) === owner);
  const ownerRole = ownerMember?.role ?? me.role;
  const clinical = isBookableRole(ownerRole);
  const title = availabilityPageTitle(ownerRole);
  const allowedSites = useEhrExt(() => hourSitesFor(owner));
  const sites = listSiteCalendars().filter((s) => s.calendar && allowedSites.includes(s.site.id));
  const tags = useEhrExt(() => listCareTags());
  const frozen = useEhrExt(() => bookingsFrozen(owner));
  const [svcOpen, setSvcOpen] = useState(false);
  const [svcSite, setSvcSite] = useState<string>("");
  const [svcDraft, setSvcDraft] = useState<string[] | null>(null);
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
          <h1 className="font-display text-2xl text-navy">{title}</h1>
          <p className="text-sm text-muted-foreground">{clinical ? "Working hours per site, care types and time off. Booking and your note-signing clock follow this." : "Your working hours and time off."} <Badge variant="outline">Draft — pending clinical sign-off</Badge></p>
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
                  <span>{b.start}–{b.end}<br /><span className="text-muted-foreground">{siteName(siteForBlock(b))}{clinical ? (b.modality === "virtual" ? " · telehealth" : b.modality === "in_person" ? " · in person" : " · both") : ""}</span>
                    {clinical && <span className="block text-muted-foreground" data-testid="block-care-types">{effectiveBlockTags(b, siteForBlock(b)).map(careTagLabel).join(", ")}</span>}
                    {clinical && blockNeedsCareTypes(b) && <span className="block text-amber-700" data-testid="set-care-types-nudge">Set care types</span>}</span>
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

      {clinical && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid="freeze-card">
          <div>
            <h2 className="font-semibold">Bookings</h2>
            <p className="text-sm text-muted-foreground">{frozen ? "Frozen — no new bookings. Existing visits were flagged for coordinator review." : "Accepting bookings."}</p>
          </div>
          <Button size="sm" variant={frozen ? "default" : "outline"} onClick={() => run("bookings_freeze", "setBookingsFrozen", { clinicianId: owner, frozen: !frozen, reason: frozen ? "Bookings reactivated" : "Bookings frozen" }, frozen ? "Bookings re-enabled." : "Bookings frozen. Existing appointments flagged for coordinator review.")}>
            {frozen ? "Reactivate bookings" : "Freeze bookings"}
          </Button>
        </Card>
      )}

      {canEditSiteServices(me.role) && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><h2 className="font-semibold">Site services offered</h2><p className="text-sm text-muted-foreground">Care types each site offers. Hours can only carry these.</p></div>
          <Button size="sm" variant="outline" onClick={() => setSvcOpen(true)}>Edit site services</Button>
        </Card>
      )}

      <CalendarSyncCard key={owner} ownerId={owner} actor={actor} />

      <Sheet open={hoursOpen} onOpenChange={setHoursOpen}>
        <SheetContent side="right" className="space-y-3">
          <SheetHeader><SheetTitle>Add working hours</SheetTitle></SheetHeader>
          <Label>Day</Label>
          <Select value={String(draft.weekday)} onValueChange={(v) => setDraft({ ...draft, weekday: Number(v) as AvailabilityBlock["weekday"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 6, 0].map((d) => <SelectItem key={d} value={String(d)}>{DAYS[d]}</SelectItem>)}</SelectContent></Select>
          <div className="grid grid-cols-2 gap-2"><div><Label>Start</Label><Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></div><div><Label>End</Label><Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></div></div>
          <Label>Site (telehealth: the site you bill under)</Label>
          <Select value={draft.siteId} onValueChange={(v) => setDraft({ ...draft, siteId: v })}><SelectTrigger><SelectValue placeholder="Pick a site" /></SelectTrigger><SelectContent>{sites.map((s) => <SelectItem key={s.site.id} value={s.site.id}>{s.site.name}</SelectItem>)}</SelectContent></Select>
          {sites.length < listSiteCalendars().filter((x) => x.calendar).length && <p className="text-xs text-muted-foreground">Only your primary facility and secondary locations (My profile).</p>}
          {clinical && <>
          <Label>Type</Label>
          <Select value={draft.modality} onValueChange={(v) => setDraft({ ...draft, modality: v as AvailabilityBlock["modality"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_person">In person</SelectItem><SelectItem value="virtual">Telehealth</SelectItem><SelectItem value="hybrid">Both</SelectItem></SelectContent></Select>
          <Label>Care types</Label>
          <div className="flex flex-wrap gap-2" data-testid="hours-care-types">
            {tags.map((tg) => {
              const offered = siteServices(draft.siteId).includes(tg.id);
              const on = (draft.careTags ?? []).includes(tg.id);
              return (
                <button key={tg.id} type="button" aria-pressed={on} disabled={!offered} title={offered ? undefined : "Not offered at this site"}
                  onClick={() => setDraft({ ...draft, careTags: on ? (draft.careTags ?? []).filter((x) => x !== tg.id) : [...(draft.careTags ?? []), tg.id] })}
                  className={`min-h-9 rounded-full border px-3 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"} disabled:opacity-40 disabled:line-through`}>{tg.label}</button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Crossed-out types aren't offered at this site. None picked = everything the site offers.</p>
          </>}
          <Button className="w-full" onClick={() => run("calendar_staff_hours_save", "saveStaffHours", { ...draft, siteId: draft.siteId && allowedSites.includes(draft.siteId) ? draft.siteId : sites[0]?.site.id, clinicianId: owner, reason: "Working hours added" }, "Hours saved") && setHoursOpen(false)}>Save hours</Button>
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
      <Sheet open={svcOpen} onOpenChange={setSvcOpen}>
        <SheetContent side="right" className="space-y-3">
          <SheetHeader><SheetTitle>Site services offered</SheetTitle></SheetHeader>
          <Select value={svcSite} onValueChange={(v) => { setSvcSite(v); setSvcDraft(null); }}><SelectTrigger aria-label="Site"><SelectValue placeholder="Pick a site" /></SelectTrigger><SelectContent>{listSiteCalendars().map((x) => <SelectItem key={x.site.id} value={x.site.id}>{x.site.name}</SelectItem>)}</SelectContent></Select>
          {svcSite && (() => {
            const cur = svcDraft ?? siteServices(svcSite);
            return <>
              <div className="flex flex-wrap gap-2">{tags.map((tg) => { const on = cur.includes(tg.id); return <button key={tg.id} type="button" aria-pressed={on} onClick={() => setSvcDraft(on ? cur.filter((x) => x !== tg.id) : [...cur, tg.id])} className={`min-h-9 rounded-full border px-3 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{tg.label}</button>; })}</div>
              <Button className="w-full" onClick={() => run("site_services_set", "setSiteServices", { siteId: svcSite, tagIds: cur, reason: "Site services updated" }, "Site services saved") && setSvcOpen(false)}>Save services</Button>
            </>;
          })()}
          <p className="text-xs text-muted-foreground">Draft — pending clinical sign-off.</p>
        </SheetContent>
      </Sheet>
    </div>
  );
}

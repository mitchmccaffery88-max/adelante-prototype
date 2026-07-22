import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt, type AppointmentModality, type AvailabilityBlock } from "@/lib/ehr-ext";
import { Trash2, Plus, CalendarOff } from "lucide-react";

export const Route = createFileRoute("/clinician-availability")({
  head: () => ({
    meta: [
      { title: "My Availability — Adelante" },
      { name: "description", content: "Set weekly availability blocks and time-off exceptions." },
    ],
  }),
  component: AvailPage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AvailPage() {
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const [id, setId] = useState(clinicians[0]?.id ?? "");
  const blocks = useEhrExt(() => (id ? AdelanteEHRExt.availabilityBlocksForClinician(id) : []));
  const exceptions = useEhrExt(() => (id ? AdelanteEHRExt.availabilityExceptionsForClinician(id) : []));
  const locations = useEhr(() => AdelanteEHR.listLocations());
  const services = useEhr(() => AdelanteEHR.listServiceTypes());

  const [draft, setDraft] = useState<Omit<AvailabilityBlock, "id" | "clinicianId">>({
    weekday: 1, start: "09:00", end: "17:00", modality: "hybrid", locationId: "loc-visalia", careTypes: ["therapy_individual"],
  });
  const [offDate, setOffDate] = useState("");
  const [offNote, setOffNote] = useState("");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header>
        <h1 className="font-display text-2xl text-navy">My availability</h1>
        <p className="text-sm text-muted-foreground">Weekly hours and any dates you're out. The scheduler enforces these when patients book.</p>
      </header>

      <Card className="p-4">
        <Label className="text-xs text-muted-foreground">Acting as</Label>
        <Select value={id} onValueChange={setId}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>{clinicians.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Weekly hours</h2>
        <ul className="divide-y">
          {blocks.length === 0 && <li className="py-2 text-sm text-muted-foreground">No blocks yet.</li>}
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <b>{DAYS[b.weekday]}</b> · {b.start}–{b.end} · <Badge variant="outline">{b.modality}</Badge>{" "}
                {b.locationId && <span className="text-muted-foreground">@ {AdelanteEHR.getLocation(b.locationId)?.name}</span>}
                <span className="text-muted-foreground"> · {b.careTypes.join(", ") || "any"}</span>
              </span>
              <Button size="icon" variant="ghost" onClick={() => { AdelanteEHRExt.removeAvailabilityBlock(b.id); toast.success("Removed"); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-6 items-end border-t pt-3">
          <div>
            <Label>Day</Label>
            <Select value={String(draft.weekday)} onValueChange={(v) => setDraft({ ...draft, weekday: Number(v) as AvailabilityBlock["weekday"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Start</Label><Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></div>
          <div><Label>End</Label><Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></div>
          <div>
            <Label>Modality</Label>
            <Select value={draft.modality} onValueChange={(v) => setDraft({ ...draft, modality: v as AppointmentModality })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="virtual">Virtual</SelectItem>
                <SelectItem value="in_person">In-person</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Location</Label>
            <Select value={draft.locationId ?? ""} onValueChange={(v) => setDraft({ ...draft, locationId: v || undefined })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Button
              size="sm"
              onClick={() => {
                if (!id) return;
                AdelanteEHRExt.upsertAvailabilityBlock({ ...draft, clinicianId: id });
                toast.success("Block added");
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>
          <div className="sm:col-span-6">
            <Label>Care types</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {services.map((s) => {
                const on = draft.careTypes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, careTypes: on ? draft.careTypes.filter((x) => x !== s.id) : [...draft.careTypes, s.id] })}
                    className={`text-xs px-2 py-1 rounded-full border ${on ? "bg-navy text-navy-foreground border-navy" : "bg-background"}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><CalendarOff className="h-4 w-4" /> Time off</h2>
        <ul className="divide-y">
          {exceptions.length === 0 && <li className="py-2 text-sm text-muted-foreground">No exceptions.</li>}
          {exceptions.map((e) => (
            <li key={e.id} className="py-2 text-sm flex items-center justify-between">
              <span>{e.date} — {e.kind === "off" ? "Off" : "Added hours"} {e.note && <span className="text-muted-foreground">· {e.note}</span>}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-3 items-end border-t pt-3">
          <div><Label>Date</Label><Input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Note</Label><Input value={offNote} onChange={(e) => setOffNote(e.target.value)} placeholder="Vacation / training" /></div>
          <div className="sm:col-span-3">
            <Button size="sm" onClick={() => { if (!id || !offDate) return; AdelanteEHRExt.addAvailabilityException({ clinicianId: id, date: offDate, kind: "off", note: offNote }); toast.success("Time-off added"); setOffDate(""); setOffNote(""); }}>
              Add time off
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
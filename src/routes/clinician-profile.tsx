import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";

export const Route = createFileRoute("/clinician-profile")({
  head: () => ({
    meta: [
      { title: "My Clinician Profile — Adelante" },
      { name: "description", content: "Clinician self-serve profile, specialty, and languages." },
    ],
  }),
  component: ClinicianProfilePage,
});

function ClinicianProfilePage() {
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const [id, setId] = useState(clinicians[0]?.id ?? "");
  const profile = useEhrExt(() => (id ? AdelanteEHRExt.getClinicianProfile(id) : undefined));
  const facilities = useEhrExt(() => AdelanteEHRExt.listFacilities());
  const [draft, setDraft] = useState(profile);
  // Reset draft when clinician changes.
  if (draft && draft.clinicianId !== id) setDraft(profile);

  if (!id) return <div className="p-6">No clinicians available.</div>;
  const p = draft ?? profile;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-navy">My clinician profile</h1>
        <p className="text-sm text-muted-foreground">
          What patients see and how the scheduler routes visits to you.
        </p>
      </header>

      <Card className="p-4">
        <Label className="text-xs text-muted-foreground">Acting as</Label>
        <Select value={id} onValueChange={setId}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {clinicians.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name} · {c.credential}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {!p ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-3">No profile yet — create one below.</p>
          <Button onClick={() => { AdelanteEHRExt.upsertClinicianProfile({ clinicianId: id, active: true, specialty: "", credentialType: "LCSW", careTypes: [], languages: ["English"] }); toast.success("Profile created"); }}>
            Create profile
          </Button>
        </Card>
      ) : (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={p.active ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"}>
                {p.active ? "Accepting bookings" : "Frozen"}
              </Badge>
              <span className="text-xs text-muted-foreground">{p.credentialType}</span>
            </div>
            <Button
              size="sm"
              variant={p.active ? "outline" : "default"}
              onClick={() => {
                AdelanteEHRExt.setClinicianActive(id, !p.active, "self-serve toggle");
                toast.success(p.active ? "Bookings frozen. Existing appointments flagged for coordinator review." : "Bookings re-enabled.");
              }}
            >
              {p.active ? "Freeze bookings" : "Reactivate"}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Specialty</Label>
              <Input value={p.specialty} onChange={(e) => setDraft({ ...p, specialty: e.target.value })} />
            </div>
            <div>
              <Label>Base facility</Label>
              <Select value={p.baseFacilityId ?? ""} onValueChange={(v) => setDraft({ ...p, baseFacilityId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Languages (comma-separated)</Label>
              <Input
                value={p.languages.join(", ")}
                onChange={(e) => setDraft({ ...p, languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Bio (patient-visible)</Label>
              <Textarea value={p.bio ?? ""} onChange={(e) => setDraft({ ...p, bio: e.target.value })} rows={3} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                AdelanteEHRExt.upsertClinicianProfile({ ...p });
                toast.success("Profile saved");
              }}
            >
              Save profile
            </Button>
          </div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Need to update availability or upload credentials? See{" "}
        <a className="underline" href="/clinician-availability">Availability</a> ·{" "}
        <a className="underline" href="/clinician-credentials">Credentials</a>.
      </p>
    </div>
  );
}
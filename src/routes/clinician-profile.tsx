import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { STAFF_ROSTER, useActingStaff } from "@/lib/roles";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";
import { act } from "@/lib/actions/act";
import { listSites } from "@/lib/providerReference";
import { canEditTagList, getStaffProfile, listCareTags, PROFILE_DRAFT_LABEL, profileOwnerFor, availabilityPageTitle } from "@/lib/staffProfile";
import { credentialSummary } from "@/lib/credentialAccess";

export const Route = createFileRoute("/clinician-profile")({
  head: () => ({
    meta: [
      { title: "My profile — Adelante" },
      { name: "description", content: "Your specialties, primary facility, secondary locations and credentials summary." },
      { property: "og:title", content: "My profile — Adelante" },
      { property: "og:description", content: "Staff profile: specialty tags, locations and credentials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffProfilePage,
});

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick}
      className={`min-h-9 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"} disabled:opacity-40`}>
      {children}
    </button>
  );
}

function StaffProfilePage() {
  const me = useActingStaff();
  const manager = canEditTagList(me.role);
  const [picked, setPicked] = useState<string>("");
  const staffId = manager && picked ? picked : me.staffId;
  const ownerId = profileOwnerFor(staffId);
  const member = STAFF_ROSTER.find((s) => s.id === staffId);
  const profile = useEhrExt(() => getStaffProfile(ownerId));
  const tags = useEhrExt(() => listCareTags());
  const ext = useEhrExt(() => AdelanteEHRExt.getClinicianProfile(ownerId));
  const creds = useEhrExt(() => (member?.clinicianId ? AdelanteEHRExt.credentialsForClinician(member.clinicianId) : []));
  const sites = listSites();
  const [draft, setDraft] = useState<{ key: string; tags: string[]; primary?: string; secondary: string[] } | null>(null);
  const d = draft && draft.key === ownerId ? draft : { key: ownerId, tags: profile.specialtyTags, primary: profile.primarySiteId, secondary: profile.secondarySiteIds };
  const [langs, setLangs] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const run = (id: string, via: string, arg: unknown, msg: string) => {
    try { act(id, via, { role: me.role, staffId: me.staffId, staffName: me.staffName, clinicianId: me.clinicianId }, arg); toast.success(msg); return true; } catch (e) { toast.error((e as Error).message); return false; }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl text-navy">My profile</h1>
          <p className="text-sm text-muted-foreground">How the team and the scheduler see you. <Badge variant="outline">{PROFILE_DRAFT_LABEL}</Badge></p>
        </div>
        {manager && (
          <Select value={staffId} onValueChange={setPicked}>
            <SelectTrigger className="w-60" aria-label="Whose profile"><SelectValue /></SelectTrigger>
            <SelectContent>{STAFF_ROSTER.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </header>

      <Card className="space-y-4 p-4" data-testid="profile-card">
        <div>
          <div className="flex items-center justify-between">
            <Label>Specialty</Label>
            {manager && <Button size="sm" variant="ghost" onClick={() => setTagsOpen(true)}>Edit tag list</Button>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="specialty-tags">
            {tags.map((t) => <Chip key={t.id} on={d.tags.includes(t.id)} onClick={() => setDraft({ ...d, tags: toggle(d.tags, t.id) })}>{t.label}</Chip>)}
          </div>
          {profile.previousSpecialty && (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="previous-specialty">Previous specialty (free text): {profile.previousSpecialty}</p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Primary facility</Label>
            <Select value={d.primary ?? ""} onValueChange={(v) => setDraft({ ...d, primary: v, secondary: d.secondary.filter((x) => x !== v) })}>
              <SelectTrigger aria-label="Primary facility"><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Secondary locations</Label>
            <div className="mt-2 flex flex-wrap gap-2" data-testid="secondary-sites">
              {sites.filter((s) => s.id !== d.primary).map((s) => <Chip key={s.id} on={d.secondary.includes(s.id)} onClick={() => setDraft({ ...d, secondary: toggle(d.secondary, s.id) })}>{s.name}</Chip>)}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">These decide where you can add working hours. Chart access follows the sites where you have hours.</p>
        {ext && (
          <div className="grid gap-3">
            <div><Label>Languages (comma-separated)</Label><Input value={langs ?? ext.languages.join(", ")} onChange={(e) => setLangs(e.target.value)} /></div>
            <div><Label>Bio (patient-visible)</Label><Textarea rows={3} value={bio ?? ext.bio ?? ""} onChange={(e) => setBio(e.target.value)} /></div>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={() => {
            if (!run("profile_save", "saveStaffProfile", { ownerId, specialtyTags: d.tags, primarySiteId: d.primary, secondarySiteIds: d.secondary, reason: "Profile updated" }, "Profile saved")) return;
            if (ext && (langs !== null || bio !== null)) AdelanteEHRExt.upsertClinicianProfile({ ...ext, languages: (langs ?? ext.languages.join(",")).split(",").map((x) => x.trim()).filter(Boolean), bio: bio ?? ext.bio });
            setDraft(null);
          }}>Save profile</Button>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4" data-testid="credentials-summary">
        <div>
          <div className="font-semibold">My credentials</div>
          <p className="text-sm text-muted-foreground">{member?.clinicianId ? credentialSummary(creds) : "No credential file — your profile isn't linked to a clinician record."}</p>
        </div>
        <Button asChild variant="outline"><Link to="/clinician-credentials">Open credentials</Link></Button>
      </Card>

      <p className="text-xs text-muted-foreground">
        Working hours, time off and freezing bookings live on <Link className="underline" to="/my-calendar">{availabilityPageTitle(member?.role ?? me.role)}</Link>.
      </p>

      <Sheet open={tagsOpen} onOpenChange={setTagsOpen}>
        <SheetContent side="right" className="space-y-3">
          <SheetHeader><SheetTitle>Specialty / care-type tags</SheetTitle></SheetHeader>
          <p className="text-xs text-muted-foreground">One list for profile specialties, care types on hours and site services. {PROFILE_DRAFT_LABEL}.</p>
          <ul className="divide-y text-sm">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2">
                <span>{t.label}</span>
                <Button size="sm" variant="ghost" onClick={() => run("care_tag_retire", "retireCareTag", { tagId: t.id, reason: "Retired from the tag list" }, "Tag retired")}>Retire</Button>
              </li>
            ))}
          </ul>
          <Label htmlFor="new-tag">New tag</Label>
          <Input id="new-tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <Button className="w-full" onClick={() => run("care_tag_add", "addCareTag", { label: newTag, reason: "Added to the tag list" }, "Tag added") && setNewTag("")}>Add tag</Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

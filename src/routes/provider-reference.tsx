// §Batch A1 — Provider & site reference (future Master Provider File / 274 match).
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Lock, Pencil } from "lucide-react";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { act } from "@/lib/actions/act";
import {
  CADENCE_DRAFT_LABEL,
  canEditProviderRef,
  canReadProviderRef,
  listOrganizations,
  listPrograms,
  listSites,
  PLACEHOLDER_LABEL,
  providerReadiness,
  renderingPractitioners,
  SITE_FIELD_LABEL,
  SITE_PROGRAM_OPTIONS,
  type Site,
} from "@/lib/providerReference";
import { FUNDING_LABEL } from "@/lib/serviceClassification";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/provider-reference")({
  head: () => ({
    meta: [
      { title: "Provider & site reference — Adelante" },
      { name: "description", content: "Organization, sites and programs with DMC certification, CalOMS, DATAR and NPI reference numbers." },
      { property: "og:title", content: "Provider & site reference — Adelante" },
      { property: "og:description", content: "Sites, programs and provider reference numbers in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProviderReferencePage,
});

const FIELDS: (keyof Site)[] = ["name", "address", "county", "dmcCertNumber", "dmcCertExpires", "calomsProviderNumber", "datarProviderId", "npiType2", "mediCalProviderNumber"];

function ProviderReferencePage() {
  const me = useActingStaff();
  const orgs = useEhr(() => listOrganizations());
  const sites = useEhr(() => listSites());
  const readiness = useEhr(() => providerReadiness());
  const practitioners = useEhr(() => renderingPractitioners());
  const [editing, setEditing] = useState<Site | null>(null);
  if (!canReadProviderRef(me.role))
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Your role can&apos;t view provider &amp; site reference.</Card>
      </div>
    );
  const canEdit = canEditProviderRef(me.role);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-display text-2xl text-navy">Provider &amp; site reference</h1>
        <p className="text-sm text-muted-foreground">Sites, programs and the reference numbers reports and claims use. {canEdit ? "" : "Read only for your role."}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" data-testid="provider-readiness">
        <Card className="p-4"><p className="text-2xl font-semibold">{readiness.missing.length}</p><p className="text-xs text-muted-foreground">Missing fields</p></Card>
        <Card className="p-4"><p className="text-2xl font-semibold">{readiness.expiring.length}</p><p className="text-xs text-muted-foreground">Certifications expiring within 90 days</p></Card>
        <Card className="p-4"><p className="text-sm font-medium">{readiness.mpfMatch}</p><p className="text-xs text-muted-foreground">{readiness.practitionersMissingNpi} practitioner{readiness.practitionersMissingNpi === 1 ? "" : "s"} without an NPI on the staff roster</p></Card>
      </section>
      {(readiness.missing.length > 0 || readiness.expiring.length > 0) && (
        <Card className="space-y-1 border-warning bg-warning/10 p-3 text-sm">
          {readiness.expiring.map((e) => <p key={e.siteId} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {e.siteName}: DMC certification expires {e.expires} ({e.daysLeft} days).</p>)}
          {readiness.missing.map((m, i) => <p key={i}>{m.siteName}: {m.field} missing.</p>)}
        </Card>
      )}

      {orgs.map((o) => (
        <section key={o.id} className="space-y-3">
          <h2 className="font-medium">{o.name}</h2>
          {sites.filter((s) => s.orgId === o.id).map((s) => (
            <Card key={s.id} className="space-y-3 p-4" data-testid={`site-${s.id}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <Badge variant="outline">{s.county} County</Badge>
                {s.placeholder && <Badge variant="outline" className="text-[10px]">Simulated</Badge>}
                {canEdit && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(s)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>}
              </div>
              {s.placeholder && <p className="text-xs text-muted-foreground">{PLACEHOLDER_LABEL}</p>}
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {FIELDS.slice(1).map((f) => (
                  <div key={f} className="flex justify-between gap-2 border-b py-1"><dt className="text-muted-foreground">{SITE_FIELD_LABEL[f]}</dt><dd className="font-mono text-xs">{String(s[f] || "—")}</dd></div>
                ))}
              </dl>
              <p className="text-xs">Programs offered: {s.programsOffered.map((id) => SITE_PROGRAM_OPTIONS.find((x) => x.id === id)?.label).join(", ") || "—"}</p>
              <div className="space-y-2">
                {listPrograms(s.id).map((p) => (
                  <div key={p.id} className="rounded-md border p-3 text-sm">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Levels of care: {p.levelsOfCare.join(", ")}</p>
                    <p className="text-xs text-muted-foreground">Funding lanes: {p.allowedFundingLanes.map((l) => FUNDING_LABEL[l]).join(", ")}</p>
                    <p className="text-xs text-muted-foreground">County contract: {p.countyContract}</p>
                    <p className="text-xs">Reporting: {p.reporting.map((r) => `${r.report} ${r.cadence}, due the ${r.dueDay}th`).join(" · ")} <span className="text-muted-foreground">({CADENCE_DRAFT_LABEL})</span></p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </section>
      ))}

      <Card className="space-y-2 p-4">
        <p className="font-medium text-sm">Rendering practitioners</p>
        <p className="text-xs text-muted-foreground">NPIs come from the staff roster — there is one NPI record per person. <Link to="/admin-credentialing" className="underline">Credentialing</Link></p>
        <ul className="divide-y text-sm">
          {practitioners.map((p) => <li key={p.staffId} className="flex justify-between py-1.5"><span>{p.name}</span><span className="font-mono text-xs">{p.npi ?? "NPI missing"}</span></li>)}
        </ul>
      </Card>

      <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetTitle>Edit site</SheetTitle>
          <SheetDescription>Saved changes are audited.</SheetDescription>
          {editing && <SiteForm site={editing} onDone={() => setEditing(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SiteForm({ site, onDone }: { site: Site; onDone: () => void }) {
  const me = useActingStaff();
  const [form, setForm] = useState<Site>({ ...site });
  const [keepPlaceholder, setKeepPlaceholder] = useState(site.placeholder);
  const save = () => {
    try {
      act("provider_ref_save", "saveSite", { role: me.role }, { ...form, placeholder: keepPlaceholder });
      toast.success("Site saved");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const toggle = (id: Site["programsOffered"][number]) =>
    setForm((f) => ({ ...f, programsOffered: f.programsOffered.includes(id) ? f.programsOffered.filter((x) => x !== id) : [...f.programsOffered, id] }));
  return (
    <div className="mt-4 space-y-3" data-testid="site-form">
      {FIELDS.map((f) => (
        <div key={f} className="space-y-1">
          <Label htmlFor={`sf-${f}`}>{SITE_FIELD_LABEL[f]}</Label>
          <Input id={`sf-${f}`} type={f === "dmcCertExpires" ? "date" : "text"} value={String(form[f] ?? "")} onChange={(e) => setForm((x) => ({ ...x, [f]: e.target.value }))} />
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {SITE_PROGRAM_OPTIONS.map((o) => <Button key={o.id} type="button" size="sm" variant={form.programsOffered.includes(o.id) ? "default" : "outline"} onClick={() => toggle(o.id)}>{o.label}</Button>)}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepPlaceholder} onChange={(e) => setKeepPlaceholder(e.target.checked)} /> Still placeholder values (keep "Simulated" label)</label>
      <Button className="w-full" onClick={save}>Save site</Button>
    </div>
  );
}

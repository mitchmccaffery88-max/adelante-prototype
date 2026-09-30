// §Batch E2 — care partner directory. sys_admin edits; coordinators read.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { act } from "@/lib/actions/act";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  CARE_PARTNER_DRAFT_LABEL,
  NEVER_SHARED,
  PARTNER_CLUSTERS,
  PARTNER_ORG_TYPE_LABEL,
  canEditPartnerDirectory,
  canReadPartnerDirectory,
  listPartnerContacts,
  listPartnerOrgs,
  type PartnerCluster,
  type PartnerOrgType,
} from "@/lib/carePartners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/care-partners")({
  head: () => ({
    meta: [
      { title: "Care partner directory — Adelante" },
      { name: "description", content: "External care partners, the data each cluster may receive, and contacts." },
      { property: "og:title", content: "Care partner directory — Adelante" },
      { property: "og:description", content: "Staff-facing directory of outside organizations Adelante coordinates with." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarePartnersPage,
});

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function CarePartnersPage() {
  const me = useActingStaff();
  const orgs = useEhr(() => listPartnerOrgs());
  const [form, setForm] = useState<{ name: string; type: PartnerOrgType; cluster: PartnerCluster }>({ name: "", type: "community_org", cluster: "outreach" });
  if (!canReadPartnerDirectory(me.role))
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Your role can&apos;t view the care partner directory.</Card>
      </div>
    );
  const edit = canEditPartnerDirectory(me.role);
  const save = () => {
    try {
      act("partner_directory_edit", "savePartnerOrg", { ...form, actor: { role: me.role, staffId: me.staffId, name: me.staffName } });
      setForm({ ...form, name: "" });
      toast.success("Partner added");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6" data-testid="care-partner-directory">
      <header className="space-y-1">
        <h1 className="font-display text-2xl text-navy">Care partner directory</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{CARE_PARTNER_DRAFT_LABEL}</Badge>
          <Badge variant="outline">Staff-facing only — no partner portal</Badge>
          <Badge variant="outline">Never shared: {NEVER_SHARED.join(", ")}</Badge>
          {!edit && <Badge variant="secondary">Read only</Badge>}
        </div>
      </header>
      <Card className="p-4 text-sm">
        <h2 className="mb-2 font-semibold text-navy">Clusters and what each may receive</h2>
        <ul className="space-y-1">
          {Object.entries(PARTNER_CLUSTERS).map(([k, c]) => (
            <li key={k}><span className="font-medium">{c.label}:</span> {c.slice.join(", ")}{c.part2 ? " — Part 2 consent required" : ""}</li>
          ))}
        </ul>
      </Card>
      {orgs.map((o) => (
        <Card key={o.id} className="space-y-1 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{o.name}</span>
            <Badge variant="secondary">{PARTNER_CLUSTERS[o.cluster].label}</Badge>
            <Badge variant="outline">{PARTNER_ORG_TYPE_LABEL[o.type]}</Badge>
          </div>
          {listPartnerContacts(o.id).map((c) => (
            <p key={c.id} className="text-xs text-muted-foreground">{c.name}{c.title ? `, ${c.title}` : ""}{c.phone ? ` · ${c.phone}` : ""}</p>
          ))}
        </Card>
      ))}
      {edit && (
        <Card className="flex flex-wrap items-end gap-2 p-4">
          <Input className="max-w-xs" placeholder="Organization name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={selectCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PartnerOrgType })}>
            {Object.entries(PARTNER_ORG_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={selectCls} value={form.cluster} onChange={(e) => setForm({ ...form, cluster: e.target.value as PartnerCluster })}>
            {Object.entries(PARTNER_CLUSTERS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <Button onClick={save}>Add partner</Button>
        </Card>
      )}
    </div>
  );
}

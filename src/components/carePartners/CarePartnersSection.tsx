// §Batch E2 — chart "Care partners" section. Staff-facing only. SUD-based
// partners are removed (not stubbed) for roles failing the Part 2 check.
import { useState } from "react";
import { toast } from "sonner";
import { act } from "@/lib/actions/act";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import {
  CARE_PARTNER_DRAFT_LABEL,
  NEVER_SHARED,
  PARTNER_CLUSTERS,
  PARTNER_ORG_TYPE_LABEL,
  linkablePartners,
  partnerOrg,
  visibleHandoffs,
  visiblePartnerLinks,
} from "@/lib/carePartners";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function CarePartnersSection({ patientId }: { patientId: string }) {
  const { role, staffId, staffName } = useActingStaff();
  const actor = { role, staffId, name: staffName };
  const links = useEhr(() => visiblePartnerLinks(patientId, role));
  const handoffs = useEhr(() => visibleHandoffs(patientId, role));
  const options = useEhr(() => linkablePartners(patientId, role));
  const [orgId, setOrg] = useState("");
  const [purpose, setPurpose] = useState("");
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const run = (fn: () => void, msg: string) => {
    try {
      fn();
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="space-y-4" data-testid="care-partners-section">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{CARE_PARTNER_DRAFT_LABEL}</Badge>
        <Badge variant="outline">Never shared: {NEVER_SHARED.join(", ")}</Badge>
      </div>
      {links.length === 0 && <p className="text-sm text-muted-foreground">No care partners linked.</p>}
      {links.map((l) => {
        const o = partnerOrg(l.orgId)!;
        const c = PARTNER_CLUSTERS[l.cluster];
        const sel = picked[l.id] ?? [];
        return (
          <Card key={l.id} className="space-y-2 p-3 text-sm" data-testid="partner-link">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{o.name}</span>
              <Badge variant="secondary">{c.label}</Badge>
              {l.endedAt && <Badge variant="outline">Ended</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">Purpose: {l.purpose} · Consent: {l.consentRef}</p>
            {!l.endedAt && (
              <div className="flex flex-wrap items-center gap-3">
                {c.slice.map((cls) => (
                  <label key={cls} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={sel.includes(cls)} onChange={(e) => setPicked({ ...picked, [l.id]: e.target.checked ? [...sel, cls] : sel.filter((x) => x !== cls) })} />
                    {cls}
                  </label>
                ))}
                <Button size="sm" variant="outline" onClick={() => run(() => { act("partner_handoff", "recordHandoff", { linkId: l.id, classes: sel, actor, patientId }); setPicked({ ...picked, [l.id]: [] }); }, "Handoff logged")}>
                  Log handoff
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run(() => act("partner_link", "endPartnerLink", { linkId: l.id, actor, patientId }), "Link ended")}>
                  End link
                </Button>
              </div>
            )}
          </Card>
        );
      })}
      <Card className="space-y-2 p-3" data-testid="partner-link-form">
        <h3 className="text-sm font-semibold text-navy">Link a care partner</h3>
        <div className="space-y-1">
          <Label htmlFor="cp-org">Partner</Label>
          <select id="cp-org" className={selectCls} value={orgId} onChange={(e) => setOrg(e.target.value)}>
            <option value="">Choose…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name} — {PARTNER_ORG_TYPE_LABEL[o.type]} ({PARTNER_CLUSTERS[o.cluster].label})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cp-purpose">Purpose</Label>
          <Input id="cp-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Reentry coordination" />
        </div>
        <Button size="sm" onClick={() => run(() => { act("partner_link", "linkPartner", { patientId, orgId, purpose, actor }); setOrg(""); setPurpose(""); }, "Partner linked")}>
          Link partner
        </Button>
      </Card>
      {handoffs.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-navy">Handoff log (what was shared, never the content)</h3>
          {handoffs.map((h) => (
            <p key={h.id} className="text-xs">{new Date(h.at).toLocaleString()} · {partnerOrg(h.orgId)?.name} · {h.classes.join(", ")} · {h.by}</p>
          ))}
        </section>
      )}
    </div>
  );
}

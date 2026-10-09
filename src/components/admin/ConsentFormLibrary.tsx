// §Consent W1 — Legal & consent: versioned form templates.
// Draft → Legal review → Approved (Counsel: pending) → Published. Editing a
// published form creates a new version. Every change via runAction.
import { useState } from "react";
import { toast } from "sonner";
import { useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { runAction } from "@/lib/actions/runAction";
import { listFormVersions, CONSENT_DRAFT_LABEL, PLACEHOLDER_WORDING, type FormKey, type FormVersion } from "@/lib/consentForms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATUS: Record<FormVersion["status"], string> = { draft: "Draft", legal_review: "Legal review", approved: "Approved", published: "Published", retired: "Retired" };

export function ConsentFormLibrary() {
  const acting = useActingStaff();
  const actor = { role: acting.role, staffId: acting.staffId, staffName: acting.staffName };
  const storeActor = { role: acting.role, ...(acting.staffId ? { staffId: acting.staffId } : {}), name: acting.staffName ?? acting.role };
  const all = JSON.parse(useEhr(() => JSON.stringify(listFormVersions()))) as FormVersion[];
  const keys = [...new Set(all.map((v) => v.key))];
  const [edit, setEdit] = useState<FormKey | null>(null);
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const run = (id: string, via: string, args: unknown[], ok: string) => {
    const r = runAction(id, actor, undefined, { via, args });
    if (r.ok) toast.success(ok); else toast.error(r.reason);
  };
  return (
    <Card className="space-y-3 p-4" data-testid="consent-form-library">
      <div>
        <h2 className="font-semibold text-navy">Legal &amp; consent forms</h2>
        <p className="text-xs text-muted-foreground">{CONSENT_DRAFT_LABEL} · {PLACEHOLDER_WORDING}. Only Published versions can be sent; past signatures keep their version.</p>
      </div>
      <ul className="divide-y text-sm">
        {keys.map((k) => {
          const vs = all.filter((v) => v.key === k);
          const latest = vs[vs.length - 1]!;
          const pub = vs.find((v) => v.status === "published");
          return (
            <li key={k} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid={`consent-form-${k}`}>
              <span>{latest.title.en} <span className="text-[11px] text-muted-foreground">published v{pub?.version ?? "—"} · latest v{latest.version} · {latest.counsel}</span></span>
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{STATUS[latest.status]}</Badge>
                {latest.status === "published" && <Button size="sm" variant="outline" onClick={() => { setEdit(k); setSummary(latest.summary.en); setBody(latest.body.en); }}>New version</Button>}
                {latest.status === "draft" && <Button size="sm" variant="outline" onClick={() => run("consent_form_author", "submitForLegalReview", [latest.id, storeActor], "Sent to legal review")}>Send to legal review</Button>}
                {latest.status === "legal_review" && <Button size="sm" variant="outline" onClick={() => run("consent_form_publish", "approveForm", [latest.id, storeActor], "Approved (Counsel: pending)")}>Approve (Counsel: pending)</Button>}
                {latest.status === "approved" && <Button size="sm" onClick={() => run("consent_form_publish", "publishForm", [latest.id, storeActor], "Published")}>Publish</Button>}
              </span>
            </li>
          );
        })}
      </ul>
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>New version</SheetTitle></SheetHeader>
          <label className="mt-3 block text-xs">Plain-language summary (2–3 lines)<Textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={400} /></label>
          <label className="mt-3 block text-xs">Full text (English; Spanish is marked Draft)<Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} /></label>
          <Button className="mt-3 w-full" onClick={() => { run("consent_form_author", "editForm", [edit, { summary: { en: summary, es: `${summary} (Borrador — traducción pendiente)` }, body: { en: body, es: `${body} (Borrador — traducción pendiente)` } }, storeActor], "Draft version created"); setEdit(null); }}>Save as draft</Button>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

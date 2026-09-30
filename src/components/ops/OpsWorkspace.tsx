// §Turn 6 — billing tiles + Today strip, and the admin Today strip. Counts come
// only from billingWorkspace / adminToday so strip and tiles always agree.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, claimBucketCounts, useEhrExt } from "@/lib/ehr-ext";
import { useActingStaff } from "@/lib/roles";
import { adminToday, billingWorkspace } from "@/lib/billingWorkspace";
import { BILLING_STATUS_ROWS } from "@/components/billing/BillingStatusSummary";
import { openOpsAction } from "@/components/ops/OpsActionLauncher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { countyReminders } from "@/lib/countyReporting";

type TileId = "action" | "pipeline" | "payments";

function StripCount({ label, n, onClick, testId }: { label: string; n: number; onClick?: () => void; testId: string }) {
  return (
    <button type="button" data-testid={testId} data-count={n} onClick={onClick} className={`rounded-md border px-3 py-1.5 text-left text-sm ${n ? "bg-card" : "text-muted-foreground opacity-70"}`}>
      <span className="block text-lg font-semibold leading-none">{n}</span>
      <span className="text-xs">{label}</span>
    </button>
  );
}

function Tile({ id, title, summary, open, onOpenChange, children }: { id: TileId; title: string; summary: string; open: boolean; onOpenChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <Card className="p-0" data-testid={`billing-tile-${id}`}>
      <button type="button" aria-expanded={open} className="flex w-full items-center gap-2 p-3 text-left" onClick={() => onOpenChange(!open)}>
        <span className="font-medium text-navy">{title}</span>
        <span className="flex-1 truncate text-xs text-muted-foreground">{summary}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t p-3">{children}</div>}
    </Card>
  );
}

export function BillingWorkspaceTiles() {
  const { role, staffId } = useActingStaff();
  const claims = useEhrExt(() => AdelanteEHRExt.listClaims());
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const ws = billingWorkspace(role, claims);
  const key = `adelante:billing-tiles:${staffId}`;
  const [open, setOpen] = useState<Record<TileId, boolean>>({ action: true, pipeline: false, payments: false });
  useEffect(() => { try { const raw = localStorage.getItem(key); if (raw) setOpen((v) => ({ ...v, ...JSON.parse(raw) })); } catch { /* optional */ } }, [key]);
  const set = (id: TileId, v: boolean) => setOpen((o) => { const n = { ...o, [id]: v }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* optional */ } return n; });
  const name = (pid: string) => { const p = patients.find((x) => x.id === pid); return p ? `${p.firstName} ${p.lastName}` : pid; };
  const counts = claimBucketCounts(claims);
  const reminders = useEhr(() => countyReminders(role));
  const actionCount = ws.blocked.length + ws.holds.length + ws.eligibilityDue.length + reminders.length;

  return (
    <section className="space-y-3" data-testid="billing-workspace">
      <div className="flex flex-wrap gap-2" data-testid="billing-today-strip">
        <StripCount testId="strip-blocked" label="Claims blocked" n={ws.blocked.length} onClick={() => set("action", true)} />
        <StripCount testId="strip-ready" label="Ready to submit" n={ws.ready.length} onClick={() => set("pipeline", true)} />
        <StripCount testId="strip-eligibility" label="Eligibility checks due" n={ws.eligibilityDue.length} onClick={() => set("action", true)} />
        <StripCount testId="strip-payments" label="Payments to post" n={ws.paymentsToPost.length} onClick={() => set("payments", true)} />
        <StripCount testId="strip-holds" label="Duplicate holds" n={ws.holds.length} onClick={() => set("action", true)} />
      </div>
      <Tile id="action" title="Needs my action" summary={`${actionCount} items`} open={open.action} onOpenChange={(v) => set("action", v)}>
        {reminders.length > 0 && (
          <ul className="mb-3 divide-y text-sm" data-testid="county-reminders">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1">{r.label}<span className="block text-xs text-muted-foreground">County reporting · Prototype — not submitted anywhere</span></span>
                <Link to="/county-reporting" className="text-xs text-teal underline">Open</Link>
              </li>
            ))}
          </ul>
        )}
        <h3 className="text-xs font-medium uppercase text-muted-foreground">Blocked claims · <span data-testid="tile-blocked-count">{ws.blocked.length}</span></h3>
        <ul className="mb-3 divide-y text-sm">
          {ws.blocked.map(({ claim, reason }) => (
            <li key={claim.id} className="flex items-center gap-2 py-1.5" data-testid="tile-blocked-row">
              <span className="flex-1">{name(claim.patientId)} · {claim.serviceDate ?? ""}<span className="block text-xs text-muted-foreground">{reason}</span></span>
              <Button size="sm" variant="outline" onClick={() => openOpsAction(reason.startsWith("Denied") ? "claim_status" : "claim_correct", claim.id)}>{reason.startsWith("Denied") ? "Resubmit" : "Fix"}</Button>
            </li>
          ))}
        </ul>
        <h3 className="text-xs font-medium uppercase text-muted-foreground">Duplicate holds · <span data-testid="tile-holds-count">{ws.holds.length}</span></h3>
        <ul className="mb-3 divide-y text-sm">
          {ws.holds.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1">{name(c.patientId)} · {c.serviceDate ?? ""}<span className="block text-xs text-muted-foreground">Held: possible duplicate after merge</span></span>
              <Button size="sm" variant="outline" onClick={() => openOpsAction("claim_duplicate_review", c.id)}>Review</Button>
            </li>
          ))}
        </ul>
        <h3 className="text-xs font-medium uppercase text-muted-foreground">Eligibility checks due · <span data-testid="tile-eligibility-count">{ws.eligibilityDue.length}</span></h3>
        <ul className="divide-y text-sm">
          {ws.eligibilityDue.slice(0, 8).map((r) => (
            <li key={r.patientId} className="flex items-center gap-2 py-1.5"><span className="flex-1">{r.name}<span className="block text-xs text-muted-foreground">{r.state.replace(/_/g, " ")}</span></span></li>
          ))}
          {ws.eligibilityDue.length > 8 && <li className="py-1.5 text-xs"><Link to="/eligibility-worklist" className="text-teal underline">All {ws.eligibilityDue.length} on the eligibility worklist</Link></li>}
        </ul>
      </Tile>
      <Tile id="pipeline" title="Claims pipeline" summary={`${ws.ready.length} ready to submit`} open={open.pipeline} onOpenChange={(v) => set("pipeline", v)}>
        <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {BILLING_STATUS_ROWS.map((r) => <li key={r.status} className="flex justify-between rounded border px-2 py-1"><span>{r.label}</span><Badge variant="outline">{counts[r.status]}</Badge></li>)}
        </ul>
      </Tile>
      <Tile id="payments" title="Payments" summary={`${ws.paymentsToPost.length} to post`} open={open.payments} onOpenChange={(v) => set("payments", v)}>
        <ul className="divide-y text-sm">
          {ws.paymentsToPost.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1">{name(c.patientId)} · balance ${((c.patientBalanceCents ?? 0) / 100).toFixed(2)}</span>
              <Button size="sm" variant="outline" onClick={() => openOpsAction("payment_record", c.id)}>Record payment</Button>
            </li>
          ))}
          {!ws.paymentsToPost.length && <li className="py-1.5 text-muted-foreground">Nothing to post.</li>}
        </ul>
      </Tile>
    </section>
  );
}

export function AdminTodayStrip() {
  const t = useEhr(() => adminToday());
  return (
    <div className="flex flex-wrap gap-2" data-testid="admin-today-strip">
      <Link to="/data-exchange"><StripCount testId="admin-strip-matching" label="Matching queue" n={t.matching} /></Link>
      <Link to="/admin-permissions"><StripCount testId="admin-strip-blocked" label="Blocked actions (24h)" n={t.blocked24h} /></Link>
      <StripCount testId="admin-strip-failed" label="Failed notifications" n={t.failedNotifications.length} onClick={() => openOpsAction("notification_resend")} />
      <Link to="/admin-permissions"><StripCount testId="admin-strip-flags" label="Flags changed (7 days)" n={t.flagsChanged} /></Link>
    </div>
  );
}

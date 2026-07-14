import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EMR, useEMR, LANE_LABEL, type FundingLane, type BillingEntity } from "@/lib/emr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/billing")({
  head: () => ({ meta: [{ title: "Billing & claims — Adelante wireframe" }] }),
  component: BillingPage,
});

type Tab = "claims" | "isl" | "codes" | "credentialing" | "settings";

function BillingPage() {
  const [tab, setTab] = useState<Tab>("claims");
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Billing & claims</h1>
        <p className="text-sm text-muted-foreground">
          Capture every medically necessary, delivered, documented service accurately — never maximize codes. Human review remains in the loop on every submission.
        </p>
      </header>
      <div className="border-b flex gap-1">
        {(["claims","isl","codes","credentialing","settings"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-3 py-2 text-sm -mb-px border-b-2", tab === t ? "border-teal text-teal font-medium" : "border-transparent text-foreground/60")}>
            {label(t)}
          </button>
        ))}
      </div>
      {tab === "claims" && <ClaimsTab />}
      {tab === "isl" && <ISLTab />}
      {tab === "codes" && <CodesTab />}
      {tab === "credentialing" && <CredTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
function label(t: Tab) { return { claims: "Claims worklist", isl: "ISL encounters", codes: "Code & rate table", credentialing: "Credentialing", settings: "Settings" }[t]; }

function ClaimsTab() {
  const claims = useEMR((s) => s.claims);
  const people = useEMR((s) => s.people);
  const [lane, setLane] = useState<FundingLane | "all">("all");
  const rows = lane === "all" ? claims : claims.filter((c) => c.lane === lane);
  return (
    <Card>
      <div className="p-3 flex items-center gap-2 border-b">
        <label className="text-xs text-muted-foreground">Filter by lane</label>
        <select value={lane} onChange={(e) => setLane(e.target.value as any)} className="border rounded-md px-2 py-1 text-sm">
          <option value="all">All lanes</option>
          {Object.entries(LANE_LABEL).map(([id, l]) => <option key={id} value={id}>{l}</option>)}
        </select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Lane</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Payer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const person = people.find((p) => p.id === c.personId);
            return (
              <TableRow key={c.id}>
                <TableCell>{person?.firstName} {person?.lastName}</TableCell>
                <TableCell className="text-xs">{LANE_LABEL[c.lane]}</TableCell>
                <TableCell className="text-xs font-mono">{c.code}</TableCell>
                <TableCell className="text-xs">{c.payer}</TableCell>
                <TableCell className="text-sm">${c.amount}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize text-[10px]">{c.status.replace(/_/g, " ")}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function ISLTab() {
  const claims = useEMR((s) => s.claims.filter((c) => c.lane === "isl"));
  return (
    <div className="space-y-4">
      <Card className="p-4 border-info/40 bg-info/5">
        <b>ISL mandate — effective 1/1/2027.</b>
        <p className="text-sm mt-1">Non-Medi-Cal reportable encounters (uninsured, benefit-exhausted, restricted settings) have no claim but require a reported encounter. Kings County comes online with ISL as part of the pipeline pilot.</p>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Code</TableHead><TableHead>Reason</TableHead><TableHead>Export</TableHead></TableRow></TableHeader>
          <TableBody>
            {claims.map((c) => (
              <TableRow key={c.id}>
                <TableCell>Person {c.personId}</TableCell>
                <TableCell className="text-xs font-mono">{c.code}</TableCell>
                <TableCell className="text-xs">Uninsured / benefit-exhausted</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">Queued for annual export</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Button variant="outline" onClick={() => toast.success("Annual ISL export queued (stub)")}>Run annual export (stub)</Button>
    </div>
  );
}

function CodesTab() {
  const rows = useEMR((s) => s.codeRates);
  return (
    <div className="space-y-2">
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Modifier</TableHead><TableHead>Description</TableHead><TableHead>Rate</TableHead><TableHead>Effective from</TableHead><TableHead>County</TableHead><TableHead>Version</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell className="text-xs">{r.modifier ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.description}</TableCell>
                <TableCell className="text-sm">${r.rate}</TableCell>
                <TableCell className="text-xs">{r.effectiveFrom}</TableCell>
                <TableCell className="text-xs">{r.county}</TableCell>
                <TableCell className="text-xs">v{r.version}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground">Versioned — historical claims adjudicate against date-of-service rules. Kings County rows added only if/when the pilot closes.</p>
    </div>
  );
}

function CredTab() {
  const providers = useEMR((s) => s.providers);
  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Type</TableHead><TableHead>License #</TableHead><TableHead>NPI</TableHead><TableHead>DEA</TableHead><TableHead>DMC</TableHead><TableHead>Effective</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {providers.map((p) => {
            const active = !p.effectiveTo || new Date(p.effectiveTo) > new Date();
            return (
              <TableRow key={p.id}>
                <TableCell>{p.name}<div className="text-xs text-muted-foreground">{p.scope}{p.supervisor && ` · sup ${p.supervisor}`}</div></TableCell>
                <TableCell className="text-xs">{p.licenseType}</TableCell>
                <TableCell className="text-xs font-mono">{p.licenseNumber}</TableCell>
                <TableCell className="text-xs font-mono">{p.npi}</TableCell>
                <TableCell className="text-xs font-mono">{p.dea ?? "—"}</TableCell>
                <TableCell>{p.dmcCertified ? <Badge className="bg-success/15 text-success border-0 text-[10px]">Certified</Badge> : "—"}</TableCell>
                <TableCell className="text-xs">{p.effectiveFrom}</TableCell>
                <TableCell>{active ? <Badge variant="outline" className="text-success text-[10px]">Active</Badge> : <Badge variant="outline" className="text-destructive text-[10px]">Expired — hard-stop</Badge>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function SettingsTab() {
  const entity = useEMR((s) => s.billingEntity);
  return (
    <Card className="p-5 space-y-3 max-w-2xl">
      <h3 className="font-semibold">Billing entity</h3>
      <p className="text-xs text-muted-foreground">
        Adelante may bill under Dr. Bagga's clinic certification/NPI or under Adelante's own DMC/Medi-Cal enrollment.
        This toggle changes the rendering NPI on claims. Decision unresolved — the toggle makes it visible.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["bagga_clinic", "adelante"] as BillingEntity[]).map((e) => (
          <button key={e} onClick={() => { EMR.setBillingEntity(e); toast.success(`Billing entity: ${e}`); }}
            className={cn("border rounded-md p-3 text-sm text-left", entity === e ? "border-teal bg-teal/5" : "hover:bg-secondary")}>
            <b>{e === "bagga_clinic" ? "Bagga's clinic" : "Adelante"}</b>
            <p className="text-xs text-muted-foreground">{e === "bagga_clinic" ? "Uses clinic NPI 1234567890" : "Uses Adelante NPI (pending enrollment)"}</p>
          </button>
        ))}
      </div>
    </Card>
  );
}

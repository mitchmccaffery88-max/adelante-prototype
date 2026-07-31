// §Admin governance — frequency catalog + local RxNav suppressions.
//
// Deliberately NOT a sync/diff/promote pipeline: Orders queries RxNav live, so
// there is no local drug catalog to version. What admins actually own here is
// (a) the frequency registry the order picker and MAR schedule read, and
// (b) a small local exclusion list applied to RxNav search results.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr, type CatalogSuppression } from "@/lib/ehr";
import type { MedFrequency } from "@/lib/frequencies";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Ban, Clock, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/admin-catalog-governance")({
  head: () => ({
    meta: [
      { title: "Catalog governance — Adelante Admin" },
      {
        name: "description",
        content:
          "Administer the medication frequency catalog and the local suppression list applied to RxNav search results in Orders.",
      },
      { property: "og:title", content: "Catalog governance — Adelante Admin" },
      {
        property: "og:description",
        content: "Frequency catalog CRUD and local RxNav suppressions for medication ordering.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CatalogGovernancePage,
});

const BLANK_FREQ = {
  code: "",
  label: "",
  sigLabel: "",
  description: "",
  isPrn: false,
  adminTimes: "",
  maxPerDay: "",
  minGapMinutes: "",
  intervalDays: "",
  sortOrder: "",
};

function parseHours(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
}

function CatalogGovernancePage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "catalog_governance");
  const canWrite = access.level === "write";

  const frequencies = useEhr(() => AdelanteEHR.listFrequencies(true));
  const suppressions = useEhr(() => AdelanteEHR.listCatalogSuppressions(true));

  const [freqOpen, setFreqOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draft, setDraft] = useState(BLANK_FREQ);
  const [deactivating, setDeactivating] = useState<MedFrequency | null>(null);
  const [reason, setReason] = useState("");

  const [supDraft, setSupDraft] = useState({ drugName: "", rxcui: "", reason: "" });
  const [lifting, setLifting] = useState<CatalogSuppression | null>(null);
  const [liftReason, setLiftReason] = useState("");

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="Catalog governance is restricted"
          description={access.reason ?? "Your role can't view medication catalog configuration."}
        />
      </div>
    );
  }

  const openCreate = () => {
    setDraft(BLANK_FREQ);
    setEditingCode(null);
    setFreqOpen(true);
  };

  const openEdit = (f: MedFrequency) => {
    setDraft({
      code: f.code,
      label: f.label,
      sigLabel: f.sigLabel,
      description: f.description ?? "",
      isPrn: f.isPrn,
      adminTimes: f.adminTimes.join(", "),
      maxPerDay: f.maxPerDay != null ? String(f.maxPerDay) : "",
      minGapMinutes: f.minGapMinutes != null ? String(f.minGapMinutes) : "",
      intervalDays: f.intervalDays != null ? String(f.intervalDays) : "",
      sortOrder: f.sortOrder != null ? String(f.sortOrder) : "",
    });
    setEditingCode(f.code);
    setFreqOpen(true);
  };

  const saveFreq = () => {
    try {
      AdelanteEHR.saveFrequency(
        {
          code: draft.code,
          label: draft.label,
          sigLabel: draft.sigLabel,
          description: draft.description,
          isPrn: draft.isPrn,
          adminTimes: draft.isPrn ? [] : parseHours(draft.adminTimes),
          maxPerDay: draft.maxPerDay ? Number(draft.maxPerDay) : undefined,
          minGapMinutes: draft.minGapMinutes ? Number(draft.minGapMinutes) : undefined,
          intervalDays: draft.intervalDays ? Number(draft.intervalDays) : undefined,
          sortOrder: draft.sortOrder ? Number(draft.sortOrder) : undefined,
        },
        staffName,
      );
      toast.success(editingCode ? "Frequency updated" : "Frequency created");
      setFreqOpen(false);
      setDraft(BLANK_FREQ);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = (f: MedFrequency) => {
    try {
      AdelanteEHR.deleteFrequency(f.code, staffName);
      toast.success(`${f.code} deleted`);
    } catch (e) {
      // In-use protection: steer straight into deactivate-with-reason.
      toast.error((e as Error).message);
      setReason("");
      setDeactivating(f);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back to admin
      </Link>
      <header>
        <h1 className="font-display text-2xl text-navy">Catalog governance</h1>
        <p className="text-sm text-muted-foreground">
          The frequency catalog the order picker and MAR schedule read, plus the local suppression
          list applied to live RxNav search results. Products are never edited here — RxNorm is
          queried live.
        </p>
      </header>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium text-navy">
            <Clock className="h-4 w-4" /> Frequency catalog
          </div>
          {canWrite && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> New frequency
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Admin times</TableHead>
              <TableHead>PRN</TableHead>
              <TableHead>In use</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {frequencies.map((f) => {
              const usage = AdelanteEHR.frequencyUsage(f.code);
              return (
                <TableRow key={f.code} className={f.active === false ? "opacity-60" : undefined}>
                  <TableCell className="font-mono text-xs">
                    {f.code}
                    {f.active === false && (
                      <Badge variant="outline" className="ml-1.5">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {f.label}
                    {f.description && (
                      <span className="block text-xs text-muted-foreground">{f.description}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {f.isPrn ? "—" : f.adminTimes.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")}
                    {f.intervalDays && f.intervalDays > 1 && (
                      <span className="block text-muted-foreground">
                        every {f.intervalDays} days
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {f.isPrn
                      ? [
                          f.maxPerDay ? `max ${f.maxPerDay}/day` : null,
                          f.minGapMinutes ? `${f.minGapMinutes} min gap` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "PRN"
                      : "No"}
                  </TableCell>
                  <TableCell className="text-xs">{usage.count}</TableCell>
                  <TableCell className="space-x-1 text-right">
                    {canWrite && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(f)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {f.active === false ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              AdelanteEHR.setFrequencyActive(f.code, true, staffName);
                              toast.success(`${f.code} reactivated`);
                            }}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReason("");
                              setDeactivating(f);
                            }}
                          >
                            Deactivate
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(f)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          A frequency referenced by any signed or held order cannot be deleted — deactivate it with
          a reason instead, which removes it from the picker while existing orders keep resolving.
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 font-medium text-navy">
          <Ban className="h-4 w-4" /> Local suppressions
        </div>
        <p className="text-xs text-muted-foreground">
          Products RxNav carries that this organization does not stock. Suppressed items are hidden
          from search results in Orders with the reason shown; the off-catalog path with a written
          justification remains available as the escape hatch.
        </p>
        {canWrite && (
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Drug name contains…"
              aria-label="Suppressed drug name"
              value={supDraft.drugName}
              onChange={(e) => setSupDraft((d) => ({ ...d, drugName: e.target.value }))}
            />
            <Input
              placeholder="RxCUI (optional)"
              aria-label="Suppressed RxCUI"
              value={supDraft.rxcui}
              onChange={(e) => setSupDraft((d) => ({ ...d, rxcui: e.target.value }))}
            />
            <Input
              placeholder="Reason (required)"
              aria-label="Suppression reason"
              value={supDraft.reason}
              onChange={(e) => setSupDraft((d) => ({ ...d, reason: e.target.value }))}
            />
            <Button
              onClick={() => {
                try {
                  AdelanteEHR.addCatalogSuppression(supDraft, staffName);
                  setSupDraft({ drugName: "", rxcui: "", reason: "" });
                  toast.success("Suppression added");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Suppress
            </Button>
          </div>
        )}
        {suppressions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No suppressions.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppressions.map((s) => (
                <TableRow key={s.id} className={s.active ? undefined : "opacity-60"}>
                  <TableCell className="text-sm">
                    {s.drugName ?? `RxCUI ${s.rxcui}`}
                    {!s.active && (
                      <Badge variant="outline" className="ml-1.5">
                        Lifted
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.reason}
                    {s.deactivatedReason && (
                      <span className="block text-muted-foreground">
                        Lifted: {s.deactivatedReason}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.createdBy}</TableCell>
                  <TableCell className="text-right">
                    {canWrite &&
                      (s.active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLiftReason("");
                            setLifting(s);
                          }}
                        >
                          Lift
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            AdelanteEHR.setCatalogSuppressionActive(s.id, true, staffName);
                            toast.success("Suppression re-applied");
                          }}
                        >
                          Re-apply
                        </Button>
                      ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={freqOpen} onOpenChange={setFreqOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCode ? `Edit ${editingCode}` : "New frequency"}</DialogTitle>
            <DialogDescription>
              Administration times are facility-local whole hours (0–23) and drive both dispense
              quantity and MAR scheduling.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Code</Label>
              <Input
                value={draft.code}
                disabled={!!editingCode}
                aria-label="Frequency code"
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Label</Label>
              <Input
                value={draft.label}
                aria-label="Frequency label"
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Sig fragment</Label>
              <Input
                value={draft.sigLabel}
                aria-label="Sig fragment"
                placeholder="twice daily"
                onChange={(e) => setDraft((d) => ({ ...d, sigLabel: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Sort order</Label>
              <Input
                value={draft.sortOrder}
                aria-label="Sort order"
                onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                checked={draft.isPrn}
                aria-label="PRN"
                onCheckedChange={(v) => setDraft((d) => ({ ...d, isPrn: v }))}
              />
              <Label className="text-xs">PRN (as needed)</Label>
            </div>
            {draft.isPrn ? (
              <>
                <div>
                  <Label className="text-xs">Max per day</Label>
                  <Input
                    value={draft.maxPerDay}
                    aria-label="Max per day"
                    onChange={(e) => setDraft((d) => ({ ...d, maxPerDay: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Min gap (minutes)</Label>
                  <Input
                    value={draft.minGapMinutes}
                    aria-label="Min gap minutes"
                    onChange={(e) => setDraft((d) => ({ ...d, minGapMinutes: e.target.value }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-xs">Admin times (hours 0–23)</Label>
                  <Input
                    value={draft.adminTimes}
                    aria-label="Admin times"
                    placeholder="8, 20"
                    onChange={(e) => setDraft((d) => ({ ...d, adminTimes: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Interval (days)</Label>
                  <Input
                    value={draft.intervalDays}
                    aria-label="Interval days"
                    placeholder="1"
                    onChange={(e) => setDraft((d) => ({ ...d, intervalDays: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFreqOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveFreq}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {deactivating?.code}</DialogTitle>
            <DialogDescription>
              It drops out of the ordering picker immediately. Existing orders keep resolving their
              label and MAR schedule.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={2}
            value={reason}
            aria-label="Deactivation reason"
            placeholder="Reason (required)"
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                try {
                  AdelanteEHR.setFrequencyActive(deactivating!.code, false, staffName, reason);
                  toast.success(`${deactivating!.code} deactivated`);
                  setDeactivating(null);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lifting} onOpenChange={(o) => !o && setLifting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lift suppression</DialogTitle>
            <DialogDescription>
              The product becomes searchable again. The rule is kept, not deleted.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={2}
            value={liftReason}
            aria-label="Lift reason"
            placeholder="Reason (required)"
            onChange={(e) => setLiftReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLifting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                try {
                  AdelanteEHR.setCatalogSuppressionActive(
                    lifting!.id,
                    false,
                    staffName,
                    liftReason,
                  );
                  toast.success("Suppression lifted");
                  setLifting(null);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Lift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
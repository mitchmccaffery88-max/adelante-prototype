// §Population health — KPI target administration.
//
// Same simple admin-form pattern as the facility registry: a table, a create
// dialog, an edit dialog, and reason-required deactivation. Targets are never
// deleted so reporting history stays auditable.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AdelanteEHR, useEhr, type KpiTarget } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import {
  METRIC_KEY_LABELS,
  METRIC_KEYS,
  METRICS_WITHOUT_SOURCE,
  formatTargetValue,
  type MetricKey,
} from "@/lib/dashboardMetrics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ArrowLeft, Lock, Pencil, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { CalaimCodesSection } from "@/components/admin/CalaimCodesSection";

export const Route = createFileRoute("/admin-kpi-targets")({
  head: () => ({
    meta: [
      { title: "KPI targets — Adelante Admin" },
      {
        name: "description",
        content:
          "Create, edit and deactivate the population health KPI targets that the dashboard measures live metrics against.",
      },
      { property: "og:title", content: "KPI targets — Adelante Admin" },
      {
        property: "og:description",
        content: "Admin configuration for population health KPI targets and their sources.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminKpiTargetsPage,
});

const BLANK = {
  metricKey: "mar_compliance_pct" as MetricKey,
  label: METRIC_KEY_LABELS.mar_compliance_pct,
  targetValue: "95",
  unit: "percent" as "percent" | "count",
  effectiveMonth: "",
  source: "",
  notes: "",
};

function AdminKpiTargetsPage() {
  const { role, staffName } = useActingStaff();
  const access = canAccess(role, "population_health");
  const canWrite = access.level === "write";

  const targets = useEhr(() => AdelanteEHR.listKpiTargets(true));
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editing, setEditing] = useState<KpiTarget | null>(null);
  const [deactivating, setDeactivating] = useState<KpiTarget | null>(null);
  const [reason, setReason] = useState("");

  const save = () => {
    try {
      const value = Number(draft.targetValue);
      if (editing) {
        AdelanteEHR.updateKpiTarget(
          editing.id,
          {
            metricKey: draft.metricKey,
            label: draft.label,
            targetValue: value,
            unit: draft.unit,
            effectiveMonth: draft.effectiveMonth,
            source: draft.source,
            notes: draft.notes,
          },
          staffName,
        );
        toast.success("Target updated");
        setEditing(null);
      } else {
        AdelanteEHR.createKpiTarget(
          {
            metricKey: draft.metricKey,
            label: draft.label,
            targetValue: value,
            unit: draft.unit,
            effectiveMonth: draft.effectiveMonth,
            source: draft.source,
            notes: draft.notes,
          },
          staffName,
        );
        toast.success("Target created");
        setCreating(false);
      }
      setDraft(BLANK);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const openEdit = (t: KpiTarget) => {
    setDraft({
      metricKey: t.metricKey as MetricKey,
      label: t.label,
      targetValue: String(t.targetValue),
      unit: t.unit,
      effectiveMonth: t.effectiveMonth ?? "",
      source: t.source ?? "",
      notes: t.notes ?? "",
    });
    setEditing(t);
  };

  if (access.level === "none") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <EmptyState
          icon={Lock}
          title="KPI targets are restricted"
          description={access.reason ?? "Your role can't view population health configuration."}
        />
      </div>
    );
  }

  const form = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label className="text-xs">Metric</Label>
        <Select
          value={draft.metricKey}
          onValueChange={(v) =>
            setDraft((d) => ({
              ...d,
              metricKey: v as MetricKey,
              label: METRIC_KEY_LABELS[v as MetricKey],
              unit: v.endsWith("_pct") ? "percent" : "count",
            }))
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {METRIC_KEY_LABELS[k]}
                {METRICS_WITHOUT_SOURCE[k] ? " (no live metric yet)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Label</Label>
        <Input
          value={draft.label}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        />
      </div>
      <div>
        <Label className="text-xs">Target value</Label>
        <Input
          type="number"
          value={draft.targetValue}
          onChange={(e) => setDraft((d) => ({ ...d, targetValue: e.target.value }))}
        />
      </div>
      <div>
        <Label className="text-xs">Unit</Label>
        <Select
          value={draft.unit}
          onValueChange={(v) => setDraft((d) => ({ ...d, unit: v as "percent" | "count" }))}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percent">Percent</SelectItem>
            <SelectItem value="count">Count</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Effective month (YYYY-MM)</Label>
        <Input
          placeholder="2026-08"
          value={draft.effectiveMonth}
          onChange={(e) => setDraft((d) => ({ ...d, effectiveMonth: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs">Source</Label>
        <Input
          placeholder="Contract requirement, NCCHC standard, internal goal…"
          value={draft.source}
          onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2">
        <Label className="text-xs">Notes</Label>
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <Link to="/dashboards" className="inline-flex items-center gap-1 text-xs text-teal">
        <ArrowLeft className="h-3 w-3" /> Back to dashboards
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-navy">Population health configuration</h1>
          <p className="text-sm text-muted-foreground">
            KPI targets the dashboard measures live metrics against, plus the CalAIM qualifying
            code registry. A target may be set for a measure that has no live metric yet — the
            dashboard says so explicitly.
          </p>
        </div>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => {
              setDraft(BLANK);
              setCreating(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> New target
          </Button>
        )}
      </header>

      {targets.length === 0 ? (
        <EmptyState icon={Target} title="No targets yet" description="Add your first KPI target." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.map((t) => (
                <TableRow key={t.id} data-target-metric={t.metricKey}>
                  <TableCell>
                    <p className="font-medium text-navy">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.metricKey}</p>
                    {METRICS_WITHOUT_SOURCE[t.metricKey as MetricKey] && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        No live metric yet
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatTargetValue(t.targetValue, t.unit)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.source ?? "—"}</TableCell>
                  <TableCell className="text-xs">{t.effectiveMonth ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={t.active ? "default" : "outline"}>
                      {t.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {t.active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReason("");
                              setDeactivating(t);
                            }}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              AdelanteEHR.setKpiTargetActive(t.id, true, staffName);
                              toast.success("Target reactivated");
                            }}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">View only</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog
        open={creating || editing !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit KPI target" : "New KPI target"}</DialogTitle>
            <DialogDescription>
              The dashboard compares the live metric for this key against the target value.
            </DialogDescription>
          </DialogHeader>
          {form}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create target"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivating !== null} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate target</DialogTitle>
            <DialogDescription>
              {deactivating?.label} will stop appearing on the dashboard. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Why is this target being retired?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                try {
                  AdelanteEHR.setKpiTargetActive(deactivating!.id, false, staffName, reason);
                  toast.success("Target deactivated");
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
    </div>
  );
}

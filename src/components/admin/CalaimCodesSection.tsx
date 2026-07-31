// §Population health Phase 2 — CalAIM qualifying-code administration.
//
// Lives on the KPI targets admin page rather than as its own route: it is
// gated on the same `population_health` write level, curated by the same
// people, and the dashboard links to a single "manage" destination.
//
// Codes are picked from the live ICD-10 catalog via the existing
// DiagnosisPicker — never free text — so the registry can't drift onto codes
// that don't exist. A category prefix (e.g. "F10") can still be typed in the
// prefix box for list-style specifications.
import { useState } from "react";
import { AdelanteEHR, useEhr, type CalaimQualifyingCode } from "@/lib/ehr";
import { DiagnosisPicker, type DiagnosisPick } from "@/components/clinical/DiagnosisPicker";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EmptyState } from "@/components/EmptyState";
import { ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";

export function CalaimCodesSection({
  canWrite,
  staffName,
}: {
  canWrite: boolean;
  staffName: string;
}) {
  const codes = useEhr(() => AdelanteEHR.listQualifyingCodes(true));
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<DiagnosisPick | null>(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [deactivating, setDeactivating] = useState<CalaimQualifyingCode | null>(null);
  const [reason, setReason] = useState("");

  const reset = () => {
    setPick(null);
    setCode("");
    setDescription("");
  };

  const save = () => {
    try {
      AdelanteEHR.addQualifyingCode({ code, description }, staffName);
      toast.success(`${code.trim().toUpperCase()} added as a qualifying code`);
      setAdding(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section id="calaim-codes" className="space-y-3 scroll-mt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-navy">CalAIM qualifying codes</h2>
          <p className="text-sm text-muted-foreground">
            ICD-10 codes that make a patient CalAIM-eligible. A full code matches only itself; a
            category prefix like <span className="font-mono">F10</span> matches every F10.x.
          </p>
        </div>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => {
              reset();
              setAdding(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add code
          </Button>
        )}
      </div>

      {codes.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No qualifying codes configured"
          description="Until at least one code is configured, the dashboard reports CalAIM as not configured rather than as zero eligible patients."
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((c) => (
                <TableRow key={c.id} data-calaim-code={c.code}>
                  <TableCell className="font-mono text-sm text-navy">{c.code}</TableCell>
                  <TableCell className="text-sm">
                    {c.description ?? "—"}
                    {!c.active && c.deactivationReason && (
                      <p className="text-xs text-muted-foreground">
                        Retired: {c.deactivationReason}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.createdAt.slice(0, 10)} · {c.createdBy}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "default" : "outline"}>
                      {c.active ? "Active" : "Retired"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite ? (
                      c.active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReason("");
                            setDeactivating(c);
                          }}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            AdelanteEHR.reactivateQualifyingCode(c.id, staffName);
                            toast.success("Code reactivated");
                          }}
                        >
                          Reactivate
                        </Button>
                      )
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

      <Dialog open={adding} onOpenChange={(o) => !o && setAdding(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add qualifying code</DialogTitle>
            <DialogDescription>
              Search the live ICD-10 catalog, then shorten to a category prefix if the specification
              covers the whole category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <DiagnosisPicker
              placeholder="Search ICD-10 (e.g. alcohol use disorder)…"
              onPick={(p) => {
                setPick(p);
                setCode(p.icd10Code ?? "");
                setDescription(p.description);
              }}
            />
            {pick && (
              <p className="text-xs text-muted-foreground">
                Picked: <span className="font-mono">{pick.icd10Code ?? "—"}</span> ·{" "}
                {pick.description}
              </p>
            )}
            <div>
              <Label className="text-xs">Code (full code or category prefix)</Label>
              <Input
                value={code}
                placeholder="F10.20 or F10"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!code.trim()}>
              Add code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivating !== null} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deactivate {deactivating?.code}</DialogTitle>
            <DialogDescription>
              The code stops counting toward eligibility from now on. It is never deleted, and past
              audit entries keep referencing it.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Reason (required)</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                try {
                  AdelanteEHR.deactivateQualifyingCode(deactivating!.id, staffName, reason);
                  toast.success("Code deactivated");
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
    </section>
  );
}

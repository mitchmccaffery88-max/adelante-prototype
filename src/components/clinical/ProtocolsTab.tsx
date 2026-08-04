// §Worklist Phase B — protocol scheduling (CIWA/COWS/safety-cell rounds).
//
// Scheduling only. The round's clinical content is a scored NoteTemplate
// authored in the template builder; this tab picks one, sets cadence + round
// count, and pre-schedules the worklist rows. Crisis alerting is NOT
// re-implemented here: a round is documented by signing its scored note, and
// the existing Phase 3c crisis-band gate at signing fires on its own.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdelanteEHR,
  useEhr,
  worklistStatusFor,
  type CaseTask,
  type ProtocolInstance,
} from "@/lib/ehr";
import { useActingStaff, canManageProtocol } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { ClientDate } from "@/components/ClientDate";
import { Timer } from "lucide-react";

function roundState(t: CaseTask): { label: string; tone: string } {
  const s = worklistStatusFor(t);
  if (s === "completed") return { label: "Done", tone: "bg-teal/15 text-teal border-0" };
  if (s === "cancelled") return { label: "Cancelled", tone: "bg-muted text-muted-foreground border-0" };
  if (t.dueDate <= new Date().toISOString())
    return { label: "Pending", tone: "bg-warning/20 text-navy border-0" };
  return { label: "Upcoming", tone: "bg-muted text-muted-foreground border-0" };
}

export function ProtocolsTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const { staffName, role } = useActingStaff();
  const canManage = !readOnly && canManageProtocol(role);
  const instances = useEhr(() => AdelanteEHR.listProtocolInstances(patientId));
  const templates = useEhr(() => AdelanteEHR.listProtocolTemplates());

  const [protocolKey, setProtocolKey] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [cadence, setCadence] = useState("60");
  const [rounds, setRounds] = useState("8");

  const start = () => {
    try {
      AdelanteEHR.startProtocol(
        patientId,
        protocolKey,
        templateId,
        Number(cadence),
        Number(rounds),
        staffName,
        role,
      );
      setProtocolKey("");
      setTemplateId("");
      toast.success("Protocol started — rounds scheduled to the worklist.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start protocol.");
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <Card className="p-4 space-y-3">
          <div>
            <h4 className="font-display text-sm text-navy">Start protocol</h4>
            <p className="text-[11px] text-muted-foreground">
              Rounds are documented on a scored note template. Only active templates with scoring
              configured can be used — author the template first if the one you need is missing.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Protocol name</Label>
              <Input
                value={protocolKey}
                onChange={(e) => setProtocolKey(e.target.value)}
                placeholder="e.g. CIWA-Ar"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scored template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a scored template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title} (v{t.version})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cadence (minutes)</Label>
              <Input
                type="number"
                min={1}
                value={cadence}
                onChange={(e) => setCadence(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rounds</Label>
              <Input
                type="number"
                min={1}
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
              />
            </div>
          </div>
          {templates.length === 0 && (
            <p className="text-[11px] text-destructive">
              No scored note templates exist yet. A protocol cannot be started without one.
            </p>
          )}
          <Button size="sm" onClick={start} disabled={!templateId || !protocolKey.trim()}>
            Start protocol
          </Button>
        </Card>
      )}
      {!canManage && !readOnly && (
        <p className="text-[11px] text-muted-foreground">
          Your role can view protocol rounds but not start or stop a protocol.
        </p>
      )}

      {instances.length === 0 ? (
        <EmptyState icon={Timer} compact title="No protocols started" />
      ) : (
        instances.map((inst) => (
          <InstanceCard key={inst.id} instance={inst} canManage={canManage} />
        ))
      )}
    </div>
  );
}

function InstanceCard({
  instance,
  canManage,
}: {
  instance: ProtocolInstance;
  canManage: boolean;
}) {
  const { staffName, role } = useActingStaff();
  const rounds = useEhr(() => AdelanteEHR.protocolRounds(instance.id));
  const template = useEhr(() => AdelanteEHR.getNoteTemplate(instance.templateId));
  const [stopOpen, setStopOpen] = useState(false);
  const [reason, setReason] = useState("");
  const done = useMemo(
    () => rounds.filter((r) => worklistStatusFor(r) === "completed").length,
    [rounds],
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-display text-sm text-navy">
            {instance.protocolKey}{" "}
            <Badge variant="outline" className="ml-1 text-[10px]">
              {instance.status}
            </Badge>
          </h4>
          <p className="text-[11px] text-muted-foreground">
            {template?.title ?? "Template unavailable"} · every {instance.cadenceMinutes} min ·{" "}
            {done}/{instance.totalRounds} rounds documented · started by {instance.startedBy}{" "}
            <ClientDate value={instance.startedAt} />
          </p>
          {instance.stopReason && (
            <p className="text-[11px] text-muted-foreground">
              Stopped by {instance.stoppedBy}: {instance.stopReason}
            </p>
          )}
        </div>
        {canManage && instance.status === "active" && (
          <Button size="sm" variant="outline" onClick={() => setStopOpen(true)}>
            Stop
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="p-1.5">Round</th>
              <th className="p-1.5">Due</th>
              <th className="p-1.5">Status</th>
              <th className="p-1.5">Claimed by</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const st = roundState(r);
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-1.5 text-navy">{r.roundNumber}</td>
                  <td className="p-1.5">
                    <ClientDate value={r.dueDate} withTime />
                  </td>
                  <td className="p-1.5">
                    <Badge className={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="p-1.5 text-muted-foreground">{r.claimedBy ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Rounds appear in the cross-facility worklist like any other task. Document a round on the
        Notes tab using {template?.title ?? "the protocol template"} — a crisis-band score escalates
        through the existing gate at signing.
      </p>

      <AlertDialog open={stopOpen} onOpenChange={setStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop {instance.protocolKey}?</AlertDialogTitle>
            <AlertDialogDescription>
              Remaining rounds are cancelled. Rounds already documented are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                try {
                  AdelanteEHR.stopProtocol(instance.id, staffName, reason, role);
                  setStopOpen(false);
                  setReason("");
                  toast.success("Protocol stopped.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not stop protocol.");
                }
              }}
            >
              Stop protocol
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
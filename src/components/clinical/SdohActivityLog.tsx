// §SDOH Referral Thread Phase 5d-3 — the one activity log used by BOTH a
// social need and a resource referral, so the two can never drift.
//
// STAFF-ONLY. Nothing here is read by a patient-facing or advocate-facing
// surface: the entries live on `SdohPlanItem.log` / `ResourceReferral.log`, and
// no patient selector reads that field. For a Part 2-gated viewer on a
// SUD-sensitive referral this component is never rendered at all — the whole
// row is replaced by the generic restricted row from §5d-1.
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientDate } from "@/components/ClientDate";
import { useActingStaff } from "@/lib/roles";
import {
  AdelanteEHR,
  SDOH_BARRIERS,
  SDOH_BARRIERS_DRAFT_NOTE,
  SDOH_BARRIER_LABEL,
  SDOH_CONTACT_METHOD_LABEL,
  SDOH_LOG_ENTRY_TYPE_LABEL,
  type SdohBarrier,
  type SdohContactMethod,
  type SdohLogEntry,
  type SdohLogEntryType,
} from "@/lib/ehr";

const ENTRY_TYPES = Object.keys(SDOH_LOG_ENTRY_TYPE_LABEL) as SdohLogEntryType[];
const METHODS = Object.keys(SDOH_CONTACT_METHOD_LABEL) as SdohContactMethod[];

export function SdohActivityLog({
  patientId,
  target,
  targetId,
  log,
  legacyNote,
  readOnly,
}: {
  patientId: string;
  target: "need" | "referral";
  targetId: string;
  log?: SdohLogEntry[];
  /**
   * The single overwritable `note` that pre-dates the log. Shown as-is and
   * clearly marked: it has no author and no timestamp, and migrating it into
   * the log would have to invent both.
   */
  legacyNote?: string;
  readOnly: boolean;
}) {
  const { staffName, role } = useActingStaff();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [entryType, setEntryType] = useState<SdohLogEntryType>("contact_attempt");
  const [contactName, setContactName] = useState("");
  const [contactMethod, setContactMethod] = useState<SdohContactMethod | "">("");
  const [contactResult, setContactResult] = useState("");
  const [barriers, setBarriers] = useState<SdohBarrier[]>([]);
  const [documentsNeeded, setDocumentsNeeded] = useState("");
  const [documentsCollected, setDocumentsCollected] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDueDate, setNextStepDueDate] = useState("");
  const [makeTask, setMakeTask] = useState(false);

  const entries = [...(log ?? [])].sort((a, b) => (a.at < b.at ? 1 : -1));

  function reset() {
    setText("");
    setEntryType("contact_attempt");
    setContactName("");
    setContactMethod("");
    setContactResult("");
    setBarriers([]);
    setDocumentsNeeded("");
    setDocumentsCollected("");
    setNextStep("");
    setNextStepDueDate("");
    setMakeTask(false);
    setAdding(false);
  }

  const splitList = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  function save() {
    if (!text.trim()) {
      toast.error("Write what happened before saving.");
      return;
    }
    let taskId: string | undefined;
    if (makeTask) {
      if (!nextStepDueDate) {
        toast.error("A task needs a due date.");
        return;
      }
      const res = AdelanteEHR.createSdohFollowUpTask({
        patientId,
        dueDate: nextStepDueDate,
        ...(target === "need" ? { sdohItemId: targetId } : { referralId: targetId }),
        ...(nextStep.trim() ? { nextStep: nextStep.trim() } : {}),
      });
      if (!res.created) {
        // Never a silent no-op: say plainly why nothing was created.
        toast.error(res.reason);
        return;
      }
      taskId = res.task.id;
      toast.success("Follow-up task created for the case manager.");
    }
    const input = {
      text,
      entryType,
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(contactMethod ? { contactMethod } : {}),
      ...(contactResult.trim() ? { contactResult: contactResult.trim() } : {}),
      ...(barriers.length ? { barriers } : {}),
      ...(splitList(documentsNeeded).length
        ? { documentsNeeded: splitList(documentsNeeded) }
        : {}),
      ...(splitList(documentsCollected).length
        ? { documentsCollected: splitList(documentsCollected) }
        : {}),
      ...(nextStep.trim() ? { nextStep: nextStep.trim() } : {}),
      ...(nextStepDueDate ? { nextStepDueDate } : {}),
      ...(taskId ? { taskId } : {}),
    };
    if (target === "need") {
      AdelanteEHR.appendSdohNeedLog(patientId, targetId, input, { staffName, role });
    } else {
      AdelanteEHR.appendReferralLog(patientId, targetId, input, { staffName, role });
    }
    toast.success("Activity logged.");
    reset();
  }

  return (
    <div className="rounded border bg-muted/20 p-2 space-y-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-navy"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Activity log ({entries.length})
        <span className="text-[10px] text-muted-foreground">· staff only</span>
      </button>
      {open && (
        <div className="space-y-2">
          {legacyNote && (
            <div className="rounded border border-dashed p-2 text-xs text-muted-foreground">
              <div className="font-medium text-navy">Earlier note</div>
              <div>{legacyNote}</div>
              <div className="text-[10px]">
                Pre-dates the activity log — no author or time was recorded.
              </div>
            </div>
          )}
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing logged yet.</p>
          )}
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded border bg-background p-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {SDOH_LOG_ENTRY_TYPE_LABEL[e.entryType]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {e.authorName} · <ClientDate value={e.at} />
                  </span>
                </div>
                <div className="text-navy">{e.text}</div>
                {(e.contactName || e.contactMethod || e.contactResult) && (
                  <div className="text-[11px] text-muted-foreground">
                    Contact: {[e.contactName, e.contactMethod && SDOH_CONTACT_METHOD_LABEL[e.contactMethod], e.contactResult]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {e.barriers?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {e.barriers.map((b) => (
                      <Badge key={b} variant="secondary" className="text-[10px]">
                        {SDOH_BARRIER_LABEL[b]}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {e.documentsNeeded?.length ? (
                  <div className="text-[11px] text-muted-foreground">
                    Documents needed: {e.documentsNeeded.join(", ")}
                  </div>
                ) : null}
                {e.documentsCollected?.length ? (
                  <div className="text-[11px] text-muted-foreground">
                    Documents collected: {e.documentsCollected.join(", ")}
                  </div>
                ) : null}
                {e.nextStep && (
                  <div className="text-[11px] text-muted-foreground">
                    Next step: {e.nextStep}
                    {e.nextStepDueDate ? ` · due ${e.nextStepDueDate}` : ""}
                    {e.taskId ? " · task created" : ""}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!readOnly &&
            (adding ? (
              <div className="space-y-2 rounded border bg-background p-2">
                <Select
                  value={entryType}
                  onValueChange={(v) => setEntryType(v as SdohLogEntryType)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SDOH_LOG_ENTRY_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  rows={2}
                  placeholder="What happened"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Contact name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                  <Select
                    value={contactMethod}
                    onValueChange={(v) => setContactMethod(v as SdohContactMethod)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {SDOH_CONTACT_METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Result"
                    value={contactResult}
                    onChange={(e) => setContactResult(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">
                    Barriers — {SDOH_BARRIERS_DRAFT_NOTE}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {SDOH_BARRIERS.map((b) => {
                      const on = barriers.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() =>
                            setBarriers((prev) =>
                              on ? prev.filter((x) => x !== b) : [...prev, b],
                            )
                          }
                          className={`rounded border px-2 py-0.5 text-[10px] ${
                            on ? "bg-navy text-white" : "text-muted-foreground"
                          }`}
                        >
                          {SDOH_BARRIER_LABEL[b]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Documents needed (comma separated)"
                    value={documentsNeeded}
                    onChange={(e) => setDocumentsNeeded(e.target.value)}
                  />
                  <Input
                    className="h-8 text-xs"
                    placeholder="Documents collected (comma separated)"
                    value={documentsCollected}
                    onChange={(e) => setDocumentsCollected(e.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Next step"
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                  />
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={nextStepDueDate}
                    onChange={(e) => setNextStepDueDate(e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={makeTask}
                    onChange={(e) => setMakeTask(e.target.checked)}
                  />
                  Create a task for the case manager on that date
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={save}>
                    Save entry
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    Cancel
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Entries are append-only and attributed — they cannot be edited or removed.
                </p>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Log activity
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

// §Adelante Journey Phase 6 — Obligations, patient-facing and informational.
//
// Strictly population-gated with Phase 2's `PopulationGate` — a General
// Population patient never renders this — and gated a second time inside the
// store (`obligationsAvailable`) so a deep link or a stale prop cannot write.
// Nothing here talks to a supervision system; see src/lib/obligations.ts.
import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Check, Gavel, Trash2 } from "lucide-react";
import { PopulationGate } from "@/components/PopulationGate";
import {
  OBLIGATION_LABEL,
  addObligation,
  listObligations,
  removeObligation,
  setObligationCompleted,
  subscribeObligations,
  type ObligationKind,
} from "@/lib/obligations";

export function ObligationsCard({ patientId }: { patientId: string }) {
  return (
    <PopulationGate patientId={patientId} allow={["pre_release_ji", "post_release_ji"]}>
      <ObligationsBody patientId={patientId} />
    </PopulationGate>
  );
}

function ObligationsBody({ patientId }: { patientId: string }) {
  const snapshot = useSyncExternalStore(
    subscribeObligations,
    () => JSON.stringify(listObligations(patientId)),
    () => "[]",
  );
  const obligations = JSON.parse(snapshot) as ReturnType<typeof listObligations>;
  const [kind, setKind] = useState<ObligationKind>("po_check_in");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const submit = () => {
    if (!addObligation({ patientId, kind, title, when: when ? new Date(when).toISOString() : "", location, notes }))
      return;
    setTitle("");
    setWhen("");
    setLocation("");
    setNotes("");
    setAdding(false);
  };

  return (
    <Card className="p-5" data-testid="obligations-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Gavel className="h-4 w-4" /> My obligations
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Check-ins, court dates, tests and required classes you're keeping track of. This is your own
        list — it isn't connected to probation, parole or the court, and nothing here is reported to
        them.
      </p>

      <ul className="mt-4 space-y-2">
        {obligations.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            Nothing on your list yet.
          </li>
        )}
        {obligations.map((o) => (
          <li
            key={o.id}
            className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {OBLIGATION_LABEL[o.kind]}
                </Badge>
                <span className={o.completed ? "line-through text-muted-foreground" : "font-medium"}>
                  {o.title}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(o.when).toLocaleString()}
                {o.location ? ` · ${o.location}` : ""}
              </div>
              {o.notes && <p className="mt-1 text-xs text-muted-foreground">{o.notes}</p>}
            </div>
            <Button
              type="button"
              size="sm"
              variant={o.completed ? "secondary" : "outline"}
              onClick={() => setObligationCompleted(patientId, o.id, !o.completed)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeObligation(patientId, o.id)}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-4 space-y-2">
          <Select value={kind} onValueChange={(v) => setKind(v as ObligationKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(OBLIGATION_LABEL) as ObligationKind[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {OBLIGATION_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="What is it?" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Input placeholder="Where" value={location} onChange={(e) => setLocation(e.target.value)} />
          <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button type="button" onClick={submit} disabled={!title.trim() || !when}>
              Add
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="mt-4" onClick={() => setAdding(true)}>
          Add an obligation
        </Button>
      )}
    </Card>
  );
}
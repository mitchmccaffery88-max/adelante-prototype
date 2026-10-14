import { StatusChip } from "@/components/ui/status-chip";
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
import { useI18n } from "@/lib/i18n";

/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.1b8d9cc48017": {
    "en": "My obligations",
    "es": "Mis obligaciones"
  },
  "ui.441c0554345e": {
    "en": "Check-ins, court dates, tests and required classes you're keeping track of. This is your own list — it isn't connected to probation, parole or the court, and nothing here is reported to them.",
    "es": "Registros, fechas de audiencia, pruebas y clases obligatorias que estás siguiendo. Esta es tu propia lista — no está conectada con libertad condicional ni con el tribunal, y nada de lo que pongas aquí se les informará."
  },
  "ui.599c20e43a35": {
    "en": "Nothing on your list yet.",
    "es": "Aún no hay nada en tu lista."
  },
  "ui.e963907dac5c": {
    "en": "Remove",
    "es": "Eliminar"
  },
  "ui.89511a76c8cb": {
    "en": "What is it?",
    "es": "¿Qué es esto?"
  },
  "ui.525f61b67292": {
    "en": "Where",
    "es": "Dónde"
  },
  "ui.70440046a3dc": {
    "en": "Notes",
    "es": "Notas"
  },
  "ui.61cc55aa0453": {
    "en": "Add",
    "es": "Añadir"
  },
  "ui.77dfd2135f4d": {
    "en": "Cancel",
    "es": "Cancelar"
  },
  "ui.0ecfcc026734": {
    "en": "Add an obligation",
    "es": "Añadir una obligación"
  }
} as const;


export function ObligationsCard({ patientId }: { patientId: string }) {
  return (
    <PopulationGate patientId={patientId} allow={["pre_release_ji", "post_release_ji"]}>
      <ObligationsBody patientId={patientId} />
    </PopulationGate>
  );
}

function ObligationsBody({ patientId }: { patientId: string }) {
  const { lang: screenLang } = useI18n();

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
    <Card className="p-5" id="obligations" data-testid="obligations-card">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
        <Gavel className="h-4 w-4" /> {SCREEN_COPY["ui.1b8d9cc48017"][screenLang]} </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {SCREEN_COPY["ui.441c0554345e"][screenLang]} </p>

      <ul className="mt-4 space-y-2">
        {obligations.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            {SCREEN_COPY["ui.599c20e43a35"][screenLang]} </li>
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
                <StatusChip state={o.completed ? "done" : +new Date(o.when) <= Date.now() ? "yourturn" : "upnext"} />
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
              aria-label={SCREEN_COPY["ui.e963907dac5c"][screenLang]}
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
          <Input placeholder={SCREEN_COPY["ui.89511a76c8cb"][screenLang]} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Input placeholder={SCREEN_COPY["ui.525f61b67292"][screenLang]} value={location} onChange={(e) => setLocation(e.target.value)} />
          <Textarea placeholder={SCREEN_COPY["ui.70440046a3dc"][screenLang]} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button type="button" onClick={submit} disabled={!title.trim() || !when}>
              {SCREEN_COPY["ui.61cc55aa0453"][screenLang]} </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              {SCREEN_COPY["ui.77dfd2135f4d"][screenLang]} </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="mt-4" onClick={() => setAdding(true)}>
          {SCREEN_COPY["ui.0ecfcc026734"][screenLang]} </Button>
      )}
    </Card>
  );
}
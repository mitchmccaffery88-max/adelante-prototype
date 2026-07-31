// §Clinical documentation Phase 3a follow-up — guided template picker.
//
// Selection semantics are unchanged from the old <Select>: the caller still
// receives a template id (or "none") and owns the snapshot/answer/sign flow.
// This component only changes how a clinician chooses.
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NoteTemplate } from "@/lib/ehr";
import { requiredFieldSummary } from "@/lib/templateSchema";

function encounterLabel(raw: string) {
  const t = (raw || "general").replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function NoteTemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: NoteTemplate[];
  /** Template id, or "none" for the built-in free-text SOAP editor. */
  value: string;
  onChange: (id: string) => void;
}) {
  // Grouped by encounter type, alphabetical within each group, groups
  // themselves alphabetical. Encounter type is the axis a clinician already
  // has in mind when they start a note ("this is an intake"), and it stays
  // stable across sessions — unlike most-recently-used, which this in-memory
  // store cannot persist per-clinician anyway.
  const groups = new Map<string, NoteTemplate[]>();
  for (const t of templates) {
    const k = encounterLabel(t.encounterType);
    const list = groups.get(k) ?? [];
    list.push(t);
    groups.set(k, list);
  }
  const ordered = [...groups.entries()]
    .map(([k, list]) => [k, [...list].sort((a, b) => a.title.localeCompare(b.title))] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const optionClass = (selected: boolean) =>
    cn(
      "w-full rounded-md border p-3 text-left transition-colors",
      selected
        ? "border-primary bg-primary/5 ring-1 ring-primary"
        : "border-border hover:border-primary/50 hover:bg-muted/40",
    );

  return (
    <div role="radiogroup" aria-label="Note template" className="space-y-2">
      <button
        type="button"
        role="radio"
        aria-checked={value === "none"}
        className={optionClass(value === "none")}
        onClick={() => onChange("none")}
      >
        <span className="text-navy block text-sm font-medium">SOAP (no template)</span>
        <span className="text-muted-foreground mt-0.5 block text-[11px]">
          Free-text subjective / objective / assessment / plan.
        </span>
      </button>

      {ordered.map(([group, list]) => (
        <div key={group} className="space-y-2">
          <p className="text-muted-foreground pt-1 text-[11px] font-medium tracking-wide uppercase">
            {group}
          </p>
          {list.map((t) => {
            const { baseline, conditional } = requiredFieldSummary(t.schema);
            const selected = value === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={optionClass(selected)}
                onClick={() => onChange(t.id)}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-navy text-sm font-medium">{t.title}</span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {baseline} required
                  </Badge>
                </span>
                {t.description && (
                  <span className="text-muted-foreground mt-0.5 block text-[11px]">
                    {t.description}
                  </span>
                )}
                {conditional > 0 && (
                  <span className="text-muted-foreground mt-1 block text-[10px]">
                    +{conditional} more required field{conditional === 1 ? "" : "s"} may appear
                    depending on answers
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

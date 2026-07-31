// §Facility — autocomplete picker over the facility registry.
//
// Deliberately NOT a plain <Select>: staff must still be able to record a site
// that isn't in the registry yet. The control biases hard toward reuse — typing
// filters existing facilities, and the "add new" affordance only appears when
// the typed text doesn't normalize onto an existing one, so a dash or casing
// variant can never mint a duplicate reporting bucket.
import { useEffect, useMemo, useRef, useState } from "react";
import { AdelanteEHR, normalizeFacilityName, useEhr, type Facility } from "@/lib/ehr";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FacilitySelection {
  facilityId?: string;
  facilityName: string;
}

export function FacilityCombobox({
  value,
  onChange,
  id,
  placeholder = "Search facilities…",
  disabled,
}: {
  value: FacilitySelection;
  onChange: (next: FacilitySelection) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const facilities = useEhr(() => AdelanteEHR.listFacilities());
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const query = value.facilityName ?? "";
  const key = normalizeFacilityName(query);
  const matches = useMemo(
    () =>
      facilities.filter((f) => !key || normalizeFacilityName(f.name).includes(key)).slice(0, 8),
    [facilities, key],
  );
  // An exact normalized hit means "this is that facility", however it was typed.
  const exact = useMemo(
    () => facilities.find((f) => normalizeFacilityName(f.name) === key),
    [facilities, key],
  );

  const pick = (f: Facility) => {
    onChange({ facilityId: f.id, facilityName: f.name });
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrap}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          // Typing detaches the id: it is re-attached only on an explicit pick
          // or on save, where ensureFacility resolves the normalized name.
          onChange({ facilityId: undefined, facilityName: e.target.value });
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && matches.length === 1) {
            e.preventDefault();
            pick(matches[0]);
          }
        }}
      />
      {value.facilityId && (
        <Badge
          variant="outline"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 gap-1 bg-background text-[10px]"
        >
          <Check className="h-3 w-3" /> linked
        </Badge>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {matches.length === 0 && !query.trim() && (
            <p className="p-2 text-xs text-muted-foreground">No facilities on file yet.</p>
          )}
          <ul className="max-h-56 overflow-y-auto">
            {matches.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted",
                    value.facilityId === f.id && "bg-muted",
                  )}
                  onClick={() => pick(f)}
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">{f.name}</span>
                  {f.city && <span className="text-xs text-muted-foreground">{f.city}</span>}
                </button>
              </li>
            ))}
          </ul>
          {query.trim() && !exact && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-border px-2 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                onChange({ facilityId: undefined, facilityName: query.trim() });
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5 text-teal" />
              Add new facility “{query.trim()}”
            </button>
          )}
          {exact && !value.facilityId && (
            <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
              Matches existing facility “{exact.name}” — it will be linked on save.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

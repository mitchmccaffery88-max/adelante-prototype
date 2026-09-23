/**
 * §Dashboard Standardization Phase 5b — one patient lookup for all staff.
 *
 * Rendered in the shared staff top bar (global mode → opens /record/$id) and
 * inside the Clinician Workspace chart tab (inline mode → selects into the
 * tab), so the app has a single lookup pattern instead of one per page.
 *
 * HONESTY: searches the whole program. Assigned rows sort first, nothing is
 * hidden, and this grants no access — the chart still enforces role access.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { searchPatients } from "@/lib/patientSearch";
import { assignmentIdentityFor } from "@/lib/caseloadScope";
import { canAccess, useActingStaff } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const PATIENT_SEARCH_SCOPE_NOTE =
  "Searches all patients. Your assigned clients are listed first — this is a shortcut, not an access restriction.";

/** True when the acting role may see patient identity at all. */
export function canUsePatientSearch(role: Parameters<typeof canAccess>[0]): boolean {
  return canAccess(role, "demographics").level !== "none";
}

export function StaffPatientSearch({
  variant = "global",
  onSelect,
  className,
  placeholder = "Search patients — name, DOB, program ID, CIN",
}: {
  variant?: "global" | "inline";
  onSelect?: (patientId: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const { role, ...staff } = useActingStaff();
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const identity = assignmentIdentityFor(staff);
  const results = useMemo(
    () => searchPatients(patients, query, identity),
    // identity is derived from the acting staff row; depend on its parts.
    [patients, query, identity.caseManagerId, identity.clinicianId],
  );

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!canUsePatientSearch(role)) return null;

  const choose = (patientId: string) => {
    setQuery("");
    setOpen(false);
    if (onSelect) onSelect(patientId);
    else navigate({ to: "/record/$patientId", params: { patientId } });
  };

  return (
    <div
      ref={boxRef}
      className={cn("relative", variant === "global" ? "w-full sm:w-[320px]" : "w-full sm:w-[360px]", className)}
      data-testid="staff-patient-search"
    >
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-label="Search patients by name, date of birth, program ID or CIN"
        placeholder={placeholder}
        value={query}
        className="h-9 pl-8 pr-8 text-sm"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const hit = results[active];
            if (hit) choose(hit.patient.id);
          }
        }}
      />
      {query && (
        <button
          type="button"
          aria-label="Clear patient search"
          onClick={() => {
            setQuery("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              No patient matches that name, date of birth, program ID or CIN.
            </p>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={r.patient.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(r.patient.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm",
                      i === active ? "bg-secondary" : "hover:bg-secondary/60",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {r.patient.firstName} {r.patient.lastName}
                      </span>
                      {r.assigned && (
                        <span className="rounded-full bg-teal/15 px-1.5 py-0.5 text-[10px] font-medium text-teal">
                          Your caseload
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      DOB {r.patient.dob}
                      {r.patient.programId ? ` · ${r.patient.programId}` : ""}
                      {r.matchedOn === "cin" && r.patient.cin ? ` · CIN ${r.patient.cin}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t px-3 py-2 text-[10px] leading-snug text-muted-foreground">
            {PATIENT_SEARCH_SCOPE_NOTE}
          </p>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { AdelanteEHR, useEhr, type ServiceType } from "@/lib/ehr";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useActingRole } from "@/lib/roles";

interface Props {
  patientId: string;
  serviceType?: ServiceType;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
}

const ALLOWED_ROLES = new Set([
  "ecm_provider",
  "clinical_coordinator",
  "sys_admin",
  "therapist",
  "pmhnp",
]);

export function AssignClinicianButton({
  patientId,
  serviceType,
  size = "sm",
  variant = "outline",
  className,
}: Props) {
  const [role] = useActingRole();
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const allClinicians = useEhr(() => AdelanteEHR.listClinicians());
  const appointments = useEhr(() => AdelanteEHR.listAppointments());
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>("");

  const clinicians = useMemo(() => {
    return serviceType ? AdelanteEHR.cliniciansForService(serviceType) : allClinicians;
  }, [serviceType, allClinicians]);

  if (!patient) return null;
  if (!ALLOWED_ROLES.has(role)) return null;

  const current = patient.primaryClinicianId;
  const label = current ? "Reassign clinician" : "Assign clinician";

  // Lightweight load hint: count of upcoming appointments per clinician
  const now = Date.now();
  const load = new Map<string, number>();
  for (const a of appointments) {
    if (a.status !== "scheduled") continue;
    if (new Date(a.start).getTime() < now) continue;
    load.set(a.clinicianId, (load.get(a.clinicianId) ?? 0) + 1);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size={size}
          variant={variant}
          className={className}
          aria-label={label}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] space-y-3">
        <div>
          <div className="text-sm font-medium text-navy">{label}</div>
          <div className="text-xs text-muted-foreground">
            {patient.firstName} {patient.lastName}
            {current
              ? ` · Current: ${allClinicians.find((c) => c.id === current)?.name ?? "—"}`
              : " · No primary clinician yet"}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Clinician</Label>
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Choose a clinician" />
            </SelectTrigger>
            <SelectContent>
              {clinicians.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">
                  No clinicians available for this service.
                </div>
              ) : (
                clinicians.map((c) => {
                  const n = load.get(c.id) ?? 0;
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center justify-between gap-2 w-full">
                        <span>
                          {c.name}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            · {c.credential}
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.mediCalStatus === "active" ? "Medi-Cal ✓" : c.mediCalStatus}
                          {" · "}
                          {n} upcoming
                        </span>
                      </span>
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setPick("");
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!pick || pick === current}
            onClick={() => {
              const clinician = allClinicians.find((c) => c.id === pick);
              AdelanteEHR.reassignPrimaryClinician({
                patientId,
                clinicianId: pick,
                initiatedBy: role === "sys_admin" ? "admin" : "ecm_provider",
              });
              toast.success(
                current
                  ? `Reassigned to ${clinician?.name ?? "clinician"} — previous provider notified.`
                  : `Assigned to ${clinician?.name ?? "clinician"}.`,
              );
              setPick("");
              setOpen(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
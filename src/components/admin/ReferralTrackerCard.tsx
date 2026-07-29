import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientDate } from "@/components/ClientDate";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import type { EpisodeType, ReferralStatus } from "@/lib/ehr";
import { ReferralTimelineDrawer } from "@/components/ReferralTimelineDrawer";
import { ChevronRight } from "lucide-react";

const trackerStyles: Record<ReferralStatus, string> = {
  submitted: "bg-gold/30 text-navy",
  contacted: "bg-teal/20 text-teal",
  enrolled: "bg-success/20 text-success",
};
const trackerOrder: ReferralStatus[] = ["submitted", "contacted", "enrolled"];

const programOptions: { value: EpisodeType | "all"; label: string }[] = [
  { value: "all", label: "All programs" },
  { value: "mental_health", label: "Mental health" },
  { value: "sud_dmc_ods", label: "SUD (DMC-ODS)" },
  { value: "ecm", label: "ECM" },
  { value: "ji_pre_release", label: "JI pre-release" },
  { value: "bhsa", label: "BHSA" },
];

const careNeedOptions = [
  { value: "all", label: "All care needs" },
  { value: "crisis", label: "Crisis flagged" },
  { value: "ecm", label: "ECM eligible" },
  { value: "ji_reentry", label: "JI reentry" },
  { value: "unassigned", label: "Unassigned clinician" },
];

export function ReferralTrackerCard({
  referrals,
  title = "Referral status",
  limit = 5,
}: {
  referrals: ReturnType<typeof AdelanteEHR.listReferrals>;
  title?: string;
  limit?: number;
}) {
  const sourceLabels: Record<string, string> = {
    probation: "Probation",
    parole: "Parole",
    drug_court: "Drug court",
    correctional: "Correctional",
    self: "Self-referred",
    other: "Other",
  };
  // Live subscribe so timestamps update as intake/assignments advance.
  useEhr(() => AdelanteEHR.listPatients().length);
  const clinicians = AdelanteEHR.listClinicians();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [clinicianFilter, setClinicianFilter] = useState<string>("all");
  const [careNeedFilter, setCareNeedFilter] = useState<string>("all");
  const [openRefId, setOpenRefId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return referrals.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const patient = r.enrolledPatientId
        ? AdelanteEHR.getPatient(r.enrolledPatientId)
        : undefined;
      if (programFilter !== "all") {
        if (!patient) return false;
        const hasProgram = (patient.episodes ?? []).some(
          (e) => !e.closedAt && e.type === programFilter,
        );
        if (!hasProgram) return false;
      }
      if (clinicianFilter !== "all") {
        if (!patient) return false;
        if (clinicianFilter === "unassigned") {
          if (patient.primaryClinicianId) return false;
        } else if (patient.primaryClinicianId !== clinicianFilter) return false;
      }
      if (careNeedFilter !== "all") {
        if (!patient) return false;
        if (careNeedFilter === "crisis" && !patient.crisisFlag) return false;
        if (careNeedFilter === "ecm" && !patient.coverage?.ecmEligible) return false;
        if (careNeedFilter === "ji_reentry" && !patient.coverage?.jiReentryFlag) return false;
        if (careNeedFilter === "unassigned" && patient.primaryClinicianId) return false;
      }
      return true;
    });
  }, [referrals, statusFilter, programFilter, clinicianFilter, careNeedFilter]);

  const shown = filtered.slice(0, limit);
  const activeFilters =
    statusFilter !== "all" ||
    programFilter !== "all" ||
    clinicianFilter !== "all" ||
    careNeedFilter !== "all";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-display text-lg text-navy">{title}</h3>
        <Badge variant="outline" className="text-xs">
          {filtered.length}/{referrals.length}
        </Badge>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 sm:h-8 text-xs sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="enrolled">Enrolled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={programFilter} onValueChange={setProgramFilter}>
          <SelectTrigger className="h-9 sm:h-8 text-xs sm:w-[160px]"><SelectValue placeholder="Program" /></SelectTrigger>
          <SelectContent>
            {programOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={clinicianFilter} onValueChange={setClinicianFilter}>
          <SelectTrigger className="h-9 sm:h-8 text-xs sm:w-[180px]"><SelectValue placeholder="Clinician" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clinicians</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {clinicians.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={careNeedFilter} onValueChange={setCareNeedFilter}>
          <SelectTrigger className="h-9 sm:h-8 text-xs sm:w-[160px]"><SelectValue placeholder="Care need" /></SelectTrigger>
          <SelectContent>
            {careNeedOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2 h-9 sm:h-8 sm:col-span-1"
            onClick={() => {
              setStatusFilter("all");
              setProgramFilter("all");
              setClinicianFilter("all");
              setCareNeedFilter("all");
            }}
          >
            Clear
          </Button>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {activeFilters ? "No referrals match these filters." : "No referrals in the pipeline."}
        </p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const patient = r.enrolledPatientId
              ? AdelanteEHR.getPatient(r.enrolledPatientId)
              : undefined;
            const outreachAt =
              r.smsSentAt ?? (r.outreachTask === "manual_call" ? r.createdAt : undefined);
            const enrolledAt =
              patient?.enrolledAt ?? (r.status === "enrolled" ? r.createdAt : undefined);
            const stepDates: { label: string; iso?: string }[] = [
              { label: "Submitted", iso: r.createdAt },
              { label: "Outreach", iso: outreachAt },
              { label: "Enrolled", iso: enrolledAt },
            ];
            return (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenRefId(r.id)}
              className="w-full text-left border-b last:border-0 pb-3 last:pb-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-medium text-navy">
                    {r.firstName} {r.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sourceLabels[r.referralSource] ?? r.referralSource}
                    {r.referringAgency ? ` · ${r.referringAgency}` : ""} ·{" "}
                    <ClientDate value={r.createdAt} />
                  </div>
                  {r.cin && (
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      CIN ••••{r.cin.slice(-4)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`${trackerStyles[r.status]} capitalize border-0`}>
                    {r.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-teal" />
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                {trackerOrder.map((s, i) => {
                  const reached = trackerOrder.indexOf(r.status) >= i;
                  return (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full ${reached ? "bg-teal" : "bg-border"}`}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
                {stepDates.map((s) => (
                  <div key={s.label} className="min-w-0">
                    <div className="text-navy font-medium truncate">{s.label}</div>
                    <div className="text-muted-foreground truncate">
                      {s.iso ? <ClientDate value={s.iso} /> : "Pending"}
                    </div>
                  </div>
                ))}
              </div>
              {r.smsSentAt ? (
                <div className="mt-1.5 text-[10px] text-success">✓ Welcome SMS sent</div>
              ) : r.outreachTask === "manual_call" ? (
                <div className="mt-1.5 text-[10px] text-gold-foreground">
                  ⚑ Manual outreach queued (no SMS)
                </div>
              ) : null}
              {r.enrolledPatientId &&
                (() => {
                  const enrolled = AdelanteEHR.getPatient(r.enrolledPatientId);
                  return enrolled ? (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Enrolled as{" "}
                      <span className="font-mono text-navy">{enrolled.programId}</span>
                    </div>
                  ) : null;
                })()}
            </button>
            );
          })}
        </div>
      )}
      <ReferralTimelineDrawer
        referralId={openRefId}
        open={!!openRefId}
        onOpenChange={(o) => !o && setOpenRefId(null)}
      />
    </Card>
  );
}
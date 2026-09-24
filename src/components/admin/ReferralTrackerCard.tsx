import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { AdelanteEHR, useEhr, REFERRAL_SOURCE_LABELS } from "@/lib/ehr";
import type { EpisodeType } from "@/lib/ehr";
import { referrerHasContact } from "@/lib/referralOutreach";
import {
  REFERRAL_STATUS_STYLES,
  ReferralOutreachStatus,
  ReferralProgressStrip,
} from "@/components/ReferralProgressStrip";
import { referralDeclineReasonLabel } from "@/lib/referralActions";
import {
  REFERRAL_AGING_DRAFT,
  referralAging,
  referralAgingLabel,
} from "@/lib/referralAging";
import { hasOpenOutreachTask, latestOutreachAttempt } from "@/lib/referralOutreach";
import { ReferralTimelineDrawer } from "@/components/ReferralTimelineDrawer";
import { ChevronRight } from "lucide-react";

const trackerStyles = REFERRAL_STATUS_STYLES;

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
  showViewAll = false,
}: {
  referrals: ReturnType<typeof AdelanteEHR.listReferrals>;
  title?: string;
  limit?: number;
  /** §Phase 4d — dashboards keep the card and link through to the real queue. */
  showViewAll?: boolean;
}) {
  const sourceLabels: Record<string, string> = REFERRAL_SOURCE_LABELS;
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
      if (statusFilter === "outreach_needed") {
        if (!hasOpenOutreachTask(r)) return false;
      } else if (statusFilter !== "all" && r.status !== statusFilter) return false;
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
        <div className="flex items-center gap-3">
          {showViewAll && (
            <Link to="/referral-queue" className="text-xs underline text-muted-foreground">
              View all referrals
            </Link>
          )}
          <Badge variant="outline" className="text-xs">
            {filtered.length}/{referrals.length}
          </Badge>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 sm:h-8 text-xs sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="enrolled">Enrolled</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
            {/* §Phase 4e — real open manual-outreach work, not a status. */}
            <SelectItem value="outreach_needed">Outreach needed</SelectItem>
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
              latestOutreachAttempt(r)?.at ??
              r.smsSentAt ??
              (r.outreachTask === "manual_call" ? r.createdAt : undefined);
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
                    {" · "}
                    <ClientDate value={r.createdAt} />
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="queue-referred-by">
                    Referred by {r.referringAgency || "agency not given"}
                    {r.referrerName ? ` · ${r.referrerName}` : ""}
                    {!referrerHasContact(r) && (
                      <Badge variant="outline" className="ml-2 text-[10px] py-0">
                        No referrer contact
                      </Badge>
                    )}
                  </div>
                  {r.cin && (
                    <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      CIN ••••{r.cin.slice(-4)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasOpenOutreachTask(r) && (
                    <Badge className="bg-warning/20 text-navy border-0">Call needed</Badge>
                  )}
                  <ReferralStalenessBadge referral={r} />
                  <Badge className={`${trackerStyles[r.status]} capitalize border-0`}>
                    {r.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-teal" />
                </div>
              </div>
              <ReferralProgressStrip status={r.status} />
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
              {r.status === "declined" && (
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  Declined{r.declinedBy ? ` by ${r.declinedBy.name}` : ""} ·{" "}
                  {referralDeclineReasonLabel(r.declineReason ?? "")}
                </div>
              )}
              <ReferralOutreachStatus referral={r} />
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
      <p className="mt-3 text-[10px] text-muted-foreground">
        Aging badge — {REFERRAL_AGING_DRAFT.note}
      </p>
      <ReferralTimelineDrawer
        referralId={openRefId}
        open={!!openRefId}
        onOpenChange={(o: boolean) => !o && setOpenRefId(null)}
      />
    </Card>
  );
}

/**
 * §Phase 4c — computed purely from real timestamps: days since the last real
 * staff action. Closed referrals never age. The threshold is DRAFT and the
 * card says so in full underneath.
 */
function ReferralStalenessBadge({
  referral,
}: {
  referral: ReturnType<typeof AdelanteEHR.listReferrals>[number];
}) {
  const { state, days } = referralAging(referral);
  if (state === "closed" || state === "fresh") return null;
  return (
    <Badge
      variant="outline"
      className={
        state === "overdue"
          ? "border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
          : "border-gold/50 bg-gold/10 text-gold-foreground text-[10px]"
      }
      title={REFERRAL_AGING_DRAFT.label}
    >
      {referralAgingLabel(days)}
    </Badge>
  );
}
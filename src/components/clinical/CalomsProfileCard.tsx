// §Reporting Tier 2 — the chart surface for the structured CalOMS fields.
//
// Three genuinely-new typed domains are edited here (substance use, prior
// treatment, discharge) plus the SELF-REPORTED justice-involvement estimates.
//
// Two concepts are deliberately shown READ-ONLY with a pointer to where they
// are actually edited, because they are already real and structured elsewhere
// and must not get a second source of truth:
//   • employment  → `Patient.needs.employment` (the need flag)
//   • living arrangement → the reentry care plan's housing arrangement
import { useState } from "react";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  CALOMS_DRAFT_NOTE,
  CALOMS_FREQUENCIES,
  CALOMS_ROUTES,
  CALOMS_SUBSTANCES,
  DISCHARGE_REASONS,
  DISCHARGE_REASON_LABEL,
  DISCHARGE_STATUSES,
  DISCHARGE_STATUS_LABEL,
  FREQUENCY_LABEL,
  JUSTICE_REFERRAL_LABEL,
  JUSTICE_REFERRAL_SOURCES,
  JUSTICE_SELF_REPORT_NOTE,
  PRIOR_EPISODE_BUCKETS,
  PRIOR_EPISODE_LABEL,
  PRIOR_TREATMENT_TYPES,
  PRIOR_TREATMENT_TYPE_LABEL,
  ROUTE_LABEL,
  SUBSTANCE_LABEL,
  type CalomsFrequency,
  type CalomsRoute,
  type CalomsSubstance,
  type DischargeReason,
  type DischargeStatus,
  type JusticeReferralSource,
  type PriorEpisodeBucket,
  type PriorTreatmentType,
} from "@/lib/caloms";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function Picker<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  placeholder,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value ?? ""} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {labels[o]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CalomsProfileCard({
  patientId,
  readOnly = false,
}: {
  patientId: string;
  readOnly?: boolean;
}) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const profile = patient?.calomsProfile;

  const [substance, setSubstance] = useState<CalomsSubstance | undefined>();
  const [route, setRoute] = useState<CalomsRoute | undefined>();
  const [frequency, setFrequency] = useState<CalomsFrequency | undefined>();
  const [ageFirstUse, setAgeFirstUse] = useState("");

  const [priorEpisodes, setPriorEpisodes] = useState<PriorEpisodeBucket | undefined>();
  const [priorType, setPriorType] = useState<PriorTreatmentType | undefined>();

  const [dischargeStatus, setDischargeStatus] = useState<DischargeStatus | undefined>();
  const [dischargeReason, setDischargeReason] = useState<DischargeReason | undefined>();
  const [dischargeOther, setDischargeOther] = useState("");
  const [dischargedOn, setDischargedOn] = useState("");

  const [arrests12, setArrests12] = useState("");
  const [custodyMonths, setCustodyMonths] = useState("");
  const [justiceSource, setJusticeSource] = useState<JusticeReferralSource | undefined>();

  if (!patient) return null;
  const primary = profile?.substanceUse?.entries.find((e) => e.rank === "primary");
  const prior = profile?.priorTreatment;
  const latestDischarge = profile?.discharges?.[0];
  const justice = profile?.justice;
  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  return (
    <div className="space-y-4" data-testid="caloms-profile">
      <Card className="space-y-1 p-3">
        <Badge variant="outline" className="text-[10px]">
          Draft value sets
        </Badge>
        <p className="text-xs text-muted-foreground">{CALOMS_DRAFT_NOTE}</p>
      </Card>

      {/* ---- Substance use ---- */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-navy">Substance use profile</h3>
          {profile?.substanceUse && <ProvenanceBadge source={profile.substanceUse.source} />}
        </div>
        {primary ? (
          <div>
            <Row label="Primary substance" value={SUBSTANCE_LABEL[primary.substance]} />
            <Row
              label="Route"
              value={primary.route ? ROUTE_LABEL[primary.route] : "Not recorded"}
            />
            <Row
              label="Frequency (past 30 days)"
              value={primary.frequency ? FREQUENCY_LABEL[primary.frequency] : "Not recorded"}
            />
            <Row
              label="Age at first use"
              value={primary.ageAtFirstUse ?? "Not recorded"}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Not recorded yet.</p>
        )}
        {!readOnly && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Picker
                label="Primary substance"
                value={substance}
                options={CALOMS_SUBSTANCES}
                labels={SUBSTANCE_LABEL}
                onChange={setSubstance}
              />
              <Picker
                label="Route"
                value={route}
                options={CALOMS_ROUTES}
                labels={ROUTE_LABEL}
                onChange={setRoute}
              />
              <Picker
                label="Frequency (past 30 days)"
                value={frequency}
                options={CALOMS_FREQUENCIES}
                labels={FREQUENCY_LABEL}
                onChange={setFrequency}
              />
              <div className="space-y-1">
                <Label className="text-xs">Age at first use</Label>
                <Input
                  className="h-9"
                  inputMode="numeric"
                  value={ageFirstUse}
                  onChange={(e) => setAgeFirstUse(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={!substance}
              data-testid="save-substance-use"
              onClick={() => {
                if (!substance) return;
                AdelanteEHR.setSubstanceUseProfile(patientId, {
                  entries: [{ rank: "primary", substance, route, frequency, ageAtFirstUse: num(ageFirstUse) }],
                  source: "self_report",
                });
              }}
            >
              Save substance use
            </Button>
          </div>
        )}
      </Card>

      {/* ---- Prior treatment ---- */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-navy">Prior treatment history</h3>
          {prior && <ProvenanceBadge source={prior.source} />}
        </div>
        {prior ? (
          <div>
            <Row label="Prior episodes" value={PRIOR_EPISODE_LABEL[prior.priorEpisodes]} />
            <Row
              label="Most recent treatment type"
              value={
                prior.lastTreatmentType
                  ? PRIOR_TREATMENT_TYPE_LABEL[prior.lastTreatmentType]
                  : "Not recorded"
              }
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Not recorded yet.</p>
        )}
        {!readOnly && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Picker
                label="Prior episodes"
                value={priorEpisodes}
                options={PRIOR_EPISODE_BUCKETS}
                labels={PRIOR_EPISODE_LABEL}
                onChange={setPriorEpisodes}
              />
              <Picker
                label="Most recent treatment type"
                value={priorType}
                options={PRIOR_TREATMENT_TYPES}
                labels={PRIOR_TREATMENT_TYPE_LABEL}
                onChange={setPriorType}
              />
            </div>
            <Button
              size="sm"
              disabled={!priorEpisodes}
              data-testid="save-prior-treatment"
              onClick={() => {
                if (!priorEpisodes) return;
                AdelanteEHR.setPriorTreatmentHistory(patientId, {
                  priorEpisodes,
                  lastTreatmentType: priorType,
                  source: "self_report",
                });
              }}
            >
              Save prior treatment
            </Button>
          </div>
        )}
      </Card>

      {/* ---- Discharge ---- */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-navy">Discharge status &amp; reason</h3>
          {latestDischarge && <ProvenanceBadge source={latestDischarge.source} />}
        </div>
        {latestDischarge ? (
          <div>
            <Row label="Status" value={DISCHARGE_STATUS_LABEL[latestDischarge.status]} />
            <Row
              label="Reason"
              value={
                latestDischarge.reason === "other" && latestDischarge.otherReason
                  ? latestDischarge.otherReason
                  : DISCHARGE_REASON_LABEL[latestDischarge.reason]
              }
            />
            <Row label="Discharged on" value={latestDischarge.dischargedOn} />
            {(profile?.discharges?.length ?? 0) > 1 && (
              <p className="pt-1 text-[11px] text-muted-foreground">
                {profile!.discharges!.length - 1} earlier discharge record(s) kept — this list is
                append-only, corrections never overwrite history.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No discharge recorded.</p>
        )}
        {!readOnly && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Picker
                label="Discharge status"
                value={dischargeStatus}
                options={DISCHARGE_STATUSES}
                labels={DISCHARGE_STATUS_LABEL}
                onChange={setDischargeStatus}
              />
              <Picker
                label="Reason"
                value={dischargeReason}
                options={DISCHARGE_REASONS}
                labels={DISCHARGE_REASON_LABEL}
                onChange={setDischargeReason}
              />
              <div className="space-y-1">
                <Label className="text-xs">Discharged on</Label>
                <Input
                  className="h-9"
                  type="date"
                  value={dischargedOn}
                  onChange={(e) => setDischargedOn(e.target.value)}
                />
              </div>
              {dischargeReason === "other" && (
                <div className="space-y-1">
                  <Label className="text-xs">Other reason</Label>
                  <Input
                    className="h-9"
                    value={dischargeOther}
                    onChange={(e) => setDischargeOther(e.target.value)}
                  />
                </div>
              )}
            </div>
            <Button
              size="sm"
              disabled={!dischargeStatus || !dischargeReason || !dischargedOn}
              data-testid="save-discharge"
              onClick={() => {
                if (!dischargeStatus || !dischargeReason || !dischargedOn) return;
                AdelanteEHR.recordDischarge(patientId, {
                  status: dischargeStatus,
                  reason: dischargeReason,
                  otherReason: dischargeReason === "other" ? dischargeOther : undefined,
                  dischargedOn,
                  source: "internal",
                });
              }}
            >
              Record discharge
            </Button>
          </div>
        )}
      </Card>

      {/* ---- Justice involvement (self-reported) ---- */}
      <Card className="space-y-3 border-amber-warm/60 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium text-navy">Justice involvement</h3>
          <ProvenanceBadge source={justice?.source ?? "self_report"} />
        </div>
        <p className="flex gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-warm-foreground" aria-hidden />
          {JUSTICE_SELF_REPORT_NOTE}
        </p>
        {justice ? (
          <div>
            <Row
              label="Arrests, past 12 months (patient estimate)"
              value={justice.arrestsPast12Months ?? "Not recorded"}
            />
            <Row
              label="Time in custody, months (patient estimate)"
              value={justice.timeInCustodyMonths ?? "Not recorded"}
            />
            <Row
              label="Justice referral source (self-reported)"
              value={
                justice.justiceReferralSource
                  ? JUSTICE_REFERRAL_LABEL[justice.justiceReferralSource]
                  : "Not recorded"
              }
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nothing reported yet.</p>
        )}
        {!readOnly && (
          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Arrests, past 12 months</Label>
                <Input
                  className="h-9"
                  inputMode="numeric"
                  value={arrests12}
                  onChange={(e) => setArrests12(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time in custody (months)</Label>
                <Input
                  className="h-9"
                  inputMode="numeric"
                  value={custodyMonths}
                  onChange={(e) => setCustodyMonths(e.target.value)}
                />
              </div>
              <Picker
                label="Justice referral source"
                value={justiceSource}
                options={JUSTICE_REFERRAL_SOURCES}
                labels={JUSTICE_REFERRAL_LABEL}
                onChange={setJusticeSource}
              />
            </div>
            <Button
              size="sm"
              data-testid="save-justice"
              onClick={() =>
                AdelanteEHR.setJusticeSelfReport(patientId, {
                  arrestsPast12Months: num(arrests12),
                  timeInCustodyMonths: num(custodyMonths),
                  justiceReferralSource: justiceSource,
                })
              }
            >
              Save self-reported estimates
            </Button>
          </div>
        )}
      </Card>

      {/* ---- Already-structured concepts, shown not duplicated ---- */}
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-medium text-navy">Already captured elsewhere</h3>
        <p className="text-xs text-muted-foreground">
          These are not re-asked here — they already have one source of truth in this record.
        </p>
        <Row
          label="Employment need flagged"
          value={patient.needs?.employment ? "Yes" : "No"}
        />
        <Row
          label="Living arrangement"
          value={patient.carePlan?.preRelease?.housingArrangement ?? "See reentry care plan"}
        />
      </Card>
    </div>
  );
}

// §Phase 8b — THE shared benefits step. Used by self-service and staff-
// assisted intake, the referral form, and the chart's "Record reported
// benefits". Controlled; the caller saves through recordIntakeBenefits.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, type Key } from "@/lib/i18n";
import { AdelanteEHR, CIN_RE, normalizeCinValue, useEhr } from "@/lib/ehr";
import { listManagedCarePlans } from "@/lib/managedCarePlans";
import {
  BENEFITS_CHOICES,
  isMediCalChoice,
  type BenefitsFormState,
} from "@/lib/intakeBenefits";

export function benefitsCinProblem(f: BenefitsFormState): boolean {
  const c = normalizeCinValue(f.cin);
  return isMediCalChoice(f.choice) && c.length > 0 && !CIN_RE.test(c);
}

export function BenefitsStep({
  value,
  onChange,
  patientId,
  referralId,
  optional = false,
  showHeading = true,
}: {
  value: BenefitsFormState;
  onChange: (v: BenefitsFormState) => void;
  patientId?: string;
  referralId?: string;
  optional?: boolean;
  showHeading?: boolean;
}) {
  const { t, lang } = useI18n();
  const plans = useEhr(() => listManagedCarePlans());
  const set = (patch: Partial<BenefitsFormState>) => onChange({ ...value, ...patch });
  const mediCal = isMediCalChoice(value.choice);
  const cin = normalizeCinValue(value.cin);
  const cinBad = benefitsCinProblem(value);
  const dup = cin && !cinBad ? AdelanteEHR.findCinDuplicate(cin, { patientId, referralId }) : undefined;
  const selected = plans.find((p) => p.id === value.planId);

  return (
    <div className="space-y-4" data-testid="benefits-step">
      {showHeading && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{t("benTitle")}</h3>
            {lang === "es" && (
              <Badge variant="outline" className="text-[10px]">
                {t("esPendingReviewBadge")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("benIntro")} {optional && t("benOptionalNote")}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm">{t("benTypeLabel")}</Label>
        <Select value={value.choice || undefined} onValueChange={(v) => set({ choice: v as BenefitsFormState["choice"] })}>
          <SelectTrigger aria-label={t("benTypeLabel")} data-testid="benefits-choice">
            <SelectValue placeholder={optional ? t("benOptionalNote") : t("benTypeLabel")} />
          </SelectTrigger>
          <SelectContent>
            {BENEFITS_CHOICES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`benChoice_${c}` as Key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mediCal && (
        <>
          <div className="space-y-1.5">
            <Label className="text-sm" htmlFor="benefits-cin">{t("benCinLabel")}</Label>
            <Input
              id="benefits-cin"
              data-testid="benefits-cin"
              maxLength={12}
              value={value.cin}
              onChange={(e) => set({ cin: normalizeCinValue(e.target.value) })}
              aria-invalid={cinBad}
            />
            <p className={`text-xs ${cinBad ? "text-destructive" : "text-muted-foreground"}`}>
              {cinBad ? t("benCinInvalid") : t("benCinHelp")}
            </p>
            {dup && <p className="text-xs text-gold-foreground" data-testid="benefits-cin-dup">{dup}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">{t("benPlanLabel")}</Label>
            <Select value={value.planId || undefined} onValueChange={(v) => set({ planId: v })}>
              <SelectTrigger aria-label={t("benPlanLabel")} data-testid="benefits-plan">
                <SelectValue placeholder={t("benPickPlan")} />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.kind === "unknown" ? t("benChoice_unknown") : p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.kind === "other" && (
              <Input
                aria-label={t("benPlanOtherLabel")}
                placeholder={t("benPlanOtherLabel")}
                value={value.planOtherName}
                onChange={(e) => set({ planOtherName: e.target.value })}
              />
            )}
          </div>
          <div className="space-y-1.5" data-testid="medi-cal-status-question">
            <Label className="text-sm">{t("benStatusLabel")}</Label>
            <Select
              value={value.mediCalStatus}
              onValueChange={(v) => set({ mediCalStatus: v as BenefitsFormState["mediCalStatus"] })}
            >
              <SelectTrigger aria-label={t("benStatusLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("benStatus_active")}</SelectItem>
                <SelectItem value="suspended">{t("benStatus_suspended")}</SelectItem>
                <SelectItem value="none_unsure">{t("benStatus_none_unsure")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{t("benMediCalNext")}</p>
        </>
      )}

      {(value.choice === "private_insurance" || value.choice === "other") && (
        <div className="space-y-1.5">
          <Label className="text-sm" htmlFor="benefits-plan-name">
            {value.choice === "private_insurance" ? t("benPrivatePlanLabel") : t("benOtherLabel")}
          </Label>
          <Input id="benefits-plan-name" value={value.planName} onChange={(e) => set({ planName: e.target.value })} />
        </div>
      )}

      {value.choice && !mediCal && <p className="text-xs text-muted-foreground">{t("benNonMediCalNext")}</p>}
    </div>
  );
}

/** Resolve the selected plan snapshot (id + name right now). */
export function selectedPlanSnapshot(planId: string) {
  const p = listManagedCarePlans({ includeRetired: true }).find((x) => x.id === planId);
  return p ? { id: p.id, name: p.name, kind: p.kind } : undefined;
}

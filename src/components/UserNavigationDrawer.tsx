import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { HeartHandshake, LifeBuoy, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  ADVOCATE_NAV_GROUPS,
  PATIENT_SIDEBAR_NAV,
  patientNavForPopulation,
} from "@/lib/navSections";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { usePopulation } from "@/components/PopulationGate";
import { recoveryJourneyVisible } from "@/lib/seeking";
import {
  SelfCareContextSwitch,
  useAdvocateSessionId,
} from "@/components/ContextSwitcher";

export function UserNavigationDrawer({ mode }: { mode: "patient" | "advocate" }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  const currentId = useEhr(() => AdelanteEHR.getCurrentPatientId());
  const patient = useEhr(() => AdelanteEHR.getPatient(currentId));
  const population = usePopulation(currentId);
  const showRecovery = recoveryJourneyVisible(patient);
  const intakeDone = Boolean(patient?.intakeCompletedAt);
  const linkId = useAdvocateSessionId();
  const identity = useEhr(() => (linkId ? AdelanteEHR.advocatePatientIdentity(linkId) : undefined));

  const close = () => setOpen(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        data-testid="user-navigation-trigger"
        aria-label={mode === "patient" ? "Open patient navigation" : "Open advocate navigation"}
        onClick={() => setOpen(true)}
        className="md:hidden shrink-0"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          data-testid="user-navigation-drawer"
          className="patient-theme flex w-[min(20rem,88vw)] flex-col gap-3 bg-sidebar p-4 pt-5 [&>button:first-of-type]:hidden"
        >
          <div className="flex min-h-11 items-center justify-between gap-3 border-b pb-3">
            <SheetTitle className="font-display text-xl text-navy">
              {mode === "patient" ? t("appName") : "Advocate access"}
            </SheetTitle>
            <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close navigation">
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </Button>
          </div>

          {mode === "patient" ? (
            <nav aria-label="Patient navigation" className="flex-1 space-y-1 overflow-y-auto">
              {patientNavForPopulation(PATIENT_SIDEBAR_NAV, population.track)
                .filter((n) => n.id !== "recovery-journey" || showRecovery)
                .map((n) => {
                  const Icon = n.icon;
                  const active = n.hash
                    ? pathname === n.to && hash === n.hash
                    : pathname === n.to && !hash;
                  return (
                    <Link
                      key={n.id}
                      to={n.to}
                      hash={n.hash}
                      onClick={close}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-medium",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground soft-shadow"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {t((n.id === "intake" && intakeDone ? "navReassess" : n.labelKey) as Parameters<typeof t>[0])}
                    </Link>
                  );
                })}
              <Link
                to="/crisis"
                onClick={close}
                className="mt-3 flex min-h-11 items-center gap-3 rounded-2xl border border-crisis/30 bg-crisis-soft px-3 py-3 font-semibold text-crisis"
              >
                <LifeBuoy className="h-5 w-5" aria-hidden="true" />
                {t("navCrisisSupport")} · 988
              </Link>
            </nav>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-2xl border border-teal/40 bg-teal/5 px-3 py-2.5 text-sm font-semibold text-navy">
                  <HeartHandshake className="h-4 w-4 text-teal" aria-hidden="true" />
                  <span className="truncate">
                    {identity?.allowed && identity.firstName
                      ? `Advocating for ${identity.firstName}`
                      : "Advocate access"}
                  </span>
                </div>
                <SelfCareContextSwitch className="text-sm" />
              </div>
              <nav aria-label="Advocate navigation" className="flex-1 space-y-4 overflow-y-auto">
                {ADVOCATE_NAV_GROUPS.map((group) => (
                  <div key={group.key} className="space-y-1">
                    <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.key === "support" && identity?.allowed && identity.firstName
                        ? `Supporting ${identity.firstName}`
                        : group.label}
                    </p>
                    {group.entries.map((n) => {
                      const Icon = n.icon;
                      return (
                        <Link
                          key={n.id}
                          to={n.to}
                          onClick={close}
                          className={cn(
                            "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-medium",
                            pathname === n.to
                              ? "bg-sidebar-primary text-sidebar-primary-foreground soft-shadow"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {n.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
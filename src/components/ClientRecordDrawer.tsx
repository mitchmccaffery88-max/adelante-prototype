import { useMemo, useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AdelanteEHR,
  useEhr,
  type CoordinationChannel,
  type CoordinationDirection,
  type ExternalPartyRole,
  type ResourceReferral,
  type SdohStatus,
  type PeerNote,
  type CaseTask,
} from "@/lib/ehr";
import {
  useActingRole,
  useActingStaff,
  getStaffMember,
  canAccess,
  type RecordClass,
} from "@/lib/roles";
import { SCREENERS, severityFor } from "@/lib/screeners";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { ClientDate } from "@/components/ClientDate";
import { toast } from "sonner";
import { Lock, ShieldAlert, Eye, EyeOff, Trash2, Plus, ClipboardList } from "lucide-react";
import { TimePicker } from "@/components/TimePicker";
import { EmptyState } from "@/components/EmptyState";
import { CarePlanCard } from "@/components/CarePlanCard";
import { AssignClinicianButton } from "@/components/AssignClinicianButton";
import { ReferralStatusTimeline } from "@/components/ReferralStatusTimeline";
import { useDraftDirty } from "@/lib/drawer-drafts";
import { ProblemsTab, AllergiesTab, AlertsTab } from "@/components/clinical/ClinicalRecordTabs";
import { OrdersTab } from "@/components/clinical/OrdersTab";
import { AlertTriangle, HeartPulse } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}

export function ClientRecordDrawer({ patientId, open, onOpenChange, initialTab }: Props) {
  const patient = useEhr(() => (patientId ? AdelanteEHR.getPatient(patientId) : undefined));
  const { role, staffName } = useActingStaff();

  if (!patient) return null;

  const gate = (cls: RecordClass) => canAccess(role, cls, patient);
  const canPeer = gate("peer_notes");
  const canSdoh = gate("sdoh");
  const canCoord = gate("case_notes"); // coordination log lives with case notes
  const canSud = gate("sud_treatment");
  const canProblems = gate("problems");
  const canAllergies = gate("allergies");
  const canAlerts = gate("alerts");
  const canContact = gate("demographics");
  const canCheckins = gate("case_notes");
  const canTasks = gate("case_notes");
  const canReferrals = gate("sdoh");
  const canEligibility = gate("eligibility");
  const canProviders = gate("care_coordination");
  const canCarePlan = gate("care_plan");
  const canNotes = gate("therapy_notes");
  const canScreenersMh = gate("screeners_mh");
  // §Orders lives under the existing meds_erx record class — orders are
  // medication actions, so reusing that gate keeps one permission surface.
  const canOrders = gate("meds_erx");

  const snapshot = patient.carePlan;
  const activeProblemsCount = snapshot?.activeProblems?.length ?? 0;
  const hiddenSud = snapshot?.hiddenSudProblems ?? 0;
  const allergyEntries = snapshot?.allergySummary ?? [];
  const severeAllergy = allergyEntries.some((a: { severity: string }) => a.severity === "severe");
  const activeAlerts = (patient.alerts ?? []).filter((a) => !a.removedAt);
  const criticalAlert = activeAlerts.some((a) => a.severity === "critical");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-navy">
            {patient.firstName} {patient.lastName}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">
              {patient.programId}
              {patient.cin ? ` · CIN ••••${patient.cin.slice(-4)}` : ""}
              {patient.dob ? ` · DOB ${patient.dob}` : ""}
            </span>
            <span className="text-xs text-muted-foreground">
              Acting as: <span className="text-navy">{staffName}</span> ·{" "}
              <span className="capitalize">{role.replace("_", " ")}</span>
            </span>
            <AssignClinicianButton patientId={patient.id} size="sm" variant="outline" />
          </SheetDescription>
          {(activeProblemsCount > 0 ||
            hiddenSud > 0 ||
            allergyEntries.length > 0 ||
            activeAlerts.length > 0) && (
            <TooltipProvider delayDuration={150}>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {activeProblemsCount > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-teal/15 text-teal border-0 text-[10px] gap-1">
                        <HeartPulse className="h-3 w-3" />
                        {activeProblemsCount} active problem
                        {activeProblemsCount === 1 ? "" : "s"}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {snapshot?.activeProblems
                        ?.slice(0, 6)
                        .map((p) => `${p.code ?? ""} ${p.label}`.trim())
                        .join(" · ")}
                    </TooltipContent>
                  </Tooltip>
                )}
                {hiddenSud > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge className="bg-destructive/10 text-destructive border-0 text-[10px] gap-1">
                        <Lock className="h-3 w-3" />
                        {hiddenSud} 42 CFR 2 masked
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      SUD problems present but hidden without Part 2 consent for your role.
                    </TooltipContent>
                  </Tooltip>
                )}
                {allergyEntries.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        className={
                          severeAllergy
                            ? "bg-destructive/15 text-destructive border-0 text-[10px] gap-1"
                            : "bg-gold/25 text-navy border-0 text-[10px] gap-1"
                        }
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {allergyEntries.length} allerg{allergyEntries.length === 1 ? "y" : "ies"}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {allergyEntries
                        .slice(0, 6)
                        .map(
                          (a: { substance: string; severity: string }) =>
                            `${a.substance} (${a.severity})`,
                        )
                        .join(" · ")}
                    </TooltipContent>
                  </Tooltip>
                )}
                {activeAlerts.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        className={
                          criticalAlert
                            ? "bg-destructive/15 text-destructive border-0 text-[10px] gap-1"
                            : "bg-muted text-navy border-0 text-[10px] gap-1"
                        }
                      >
                        <ShieldAlert className="h-3 w-3" />
                        {activeAlerts.length} alert
                        {activeAlerts.length === 1 ? "" : "s"}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {activeAlerts
                        .slice(0, 6)
                        .map((a) => `${a.label} (${a.severity})`)
                        .join(" · ")}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          )}
        </SheetHeader>

        <div className="mt-4">
          <ReferralStatusTimeline patient={patient} />
        </div>

        <Tabs defaultValue={initialTab ?? "overview"} className="mt-4">
          <TabsList className="w-full flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="checkins">Check-ins</TabsTrigger>
            <TabsTrigger value="sdoh">SDOH</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="coord">External</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            {canCarePlan.level !== "none" && <TabsTrigger value="care-plan">Care plan</TabsTrigger>}
            {canNotes.level !== "none" && <TabsTrigger value="notes">Notes</TabsTrigger>}
            {canScreenersMh.level !== "none" && (
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
            )}
            {canProblems.level !== "none" && <TabsTrigger value="problems">Problems</TabsTrigger>}
            {canAllergies.level !== "none" && (
              <TabsTrigger value="allergies">Allergies</TabsTrigger>
            )}
            {canAlerts.level !== "none" && <TabsTrigger value="alerts">Alerts</TabsTrigger>}
            {canOrders.level !== "none" && <TabsTrigger value="orders">Orders</TabsTrigger>}
            {canPeer.level !== "none" && <TabsTrigger value="peer">Peer notes</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="contact" className="mt-4">
            {canContact.locked ? (
              <LockedNote reason={canContact.reason} />
            ) : (
              <ContactTab patientId={patient.id} readOnly={canContact.level === "read"} />
            )}
          </TabsContent>
          <TabsContent value="checkins" className="mt-4">
            {canCheckins.locked ? (
              <LockedNote reason={canCheckins.reason} />
            ) : (
              <CheckInsTab patientId={patient.id} readOnly={canCheckins.level === "read"} />
            )}
          </TabsContent>
          <TabsContent value="sdoh" className="mt-4">
            {canSdoh.locked ? (
              <LockedNote reason={canSdoh.reason} />
            ) : (
              <SdohTab patientId={patient.id} readOnly={canSdoh.level === "read"} />
            )}
          </TabsContent>
          <TabsContent value="referrals" className="mt-4">
            {canReferrals.locked ? (
              <LockedNote reason={canReferrals.reason} />
            ) : (
              <ReferralsTab
                patientId={patient.id}
                sudGated={canSud.locked}
                readOnly={canReferrals.level === "read"}
              />
            )}
          </TabsContent>
          <TabsContent value="eligibility" className="mt-4">
            {canEligibility.locked ? (
              <LockedNote reason={canEligibility.reason} />
            ) : (
              <EligibilityTab patientId={patient.id} readOnly={canEligibility.level === "read"} />
            )}
          </TabsContent>
          <TabsContent value="coord" className="mt-4">
            {canCoord.locked ? (
              <LockedNote reason={canCoord.reason} />
            ) : (
              <CoordinationTab patientId={patient.id} part2Consent={patient.consents.part2Sud} />
            )}
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            {canTasks.locked ? (
              <LockedNote reason={canTasks.reason} />
            ) : (
              <TasksTab patientId={patient.id} readOnly={canTasks.level === "read"} />
            )}
          </TabsContent>
          <TabsContent value="providers" className="mt-4">
            {canProviders.locked ? (
              <LockedNote reason={canProviders.reason} />
            ) : (
              <ProviderHistoryTab patientId={patient.id} />
            )}
          </TabsContent>
          {canCarePlan.level !== "none" && (
            <TabsContent value="care-plan" className="mt-4">
              <CarePlanTab patientId={patient.id} readOnly={canCarePlan.level === "read"} />
            </TabsContent>
          )}
          {canNotes.level !== "none" && (
            <TabsContent value="notes" className="mt-4">
              <NotesTab patientId={patient.id} readOnly={canNotes.level !== "write"} />
            </TabsContent>
          )}
          {canScreenersMh.level !== "none" && (
            <TabsContent value="tracking" className="mt-4">
              <TrackingTab patientId={patient.id} />
            </TabsContent>
          )}
          {canProblems.level !== "none" && (
            <TabsContent value="problems" className="mt-4">
              <ProblemsTab patientId={patient.id} />
            </TabsContent>
          )}
          {canAllergies.level !== "none" && (
            <TabsContent value="allergies" className="mt-4">
              <AllergiesTab patientId={patient.id} />
            </TabsContent>
          )}
          {canAlerts.level !== "none" && (
            <TabsContent value="alerts" className="mt-4">
              <AlertsTab patientId={patient.id} />
            </TabsContent>
          )}
          {canOrders.level !== "none" && (
            <TabsContent value="orders" className="mt-4">
              {/* Read-only roles (no meds_erx write) can still stage orders with
                  attribution in the reference EMR; here "read" = view-only, and
                  staging requires at least read+attribution-capable roles. */}
              <OrdersTab patientId={patient.id} readOnly={canOrders.level !== "write"} />
            </TabsContent>
          )}
          {canPeer.level !== "none" && (
            <TabsContent value="peer" className="mt-4">
              <PeerNotesTab patientId={patient.id} canWrite={canPeer.level === "write"} />
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

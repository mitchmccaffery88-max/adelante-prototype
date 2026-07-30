// §Clinical record — quick-peek drawer.
// Deep clinical work happens in the full-page chart at /record/$patientId.
// This sheet is the fast look from a caseload row; it renders the SAME
// section components (see recordSections.tsx), never a forked copy.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { useActingStaff } from "@/lib/roles";
import { AssignClinicianButton } from "@/components/AssignClinicianButton";
import { ReferralStatusTimeline } from "@/components/ReferralStatusTimeline";
import { RecordSafetyBadges } from "@/components/clinical/RecordSafetyBadges";
import { useRecordSections } from "@/components/clinical/recordSections";
import { Maximize2 } from "lucide-react";

interface Props {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: string;
}

export function ClientRecordDrawer({ patientId, open, onOpenChange, initialTab }: Props) {
  const patient = useEhr(() => (patientId ? AdelanteEHR.getPatient(patientId) : undefined));
  if (!patient) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <DrawerBody patientId={patient.id} initialTab={initialTab} />
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ patientId, initialTab }: { patientId: string; initialTab?: string }) {
  const patient = useEhr(() => AdelanteEHR.getPatient(patientId));
  const { role, staffName } = useActingStaff();
  const sections = useRecordSections(patient!);
  const [tab, setTab] = useState(initialTab ?? "overview");
  if (!patient) return null;
  const active = sections.find((s) => s.id === tab) ?? sections[0];

  return (
    <>
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
        <div className="mt-2">
          <RecordSafetyBadges patient={patient} />
        </div>
        <Button asChild size="sm" variant="secondary" className="mt-2 w-fit">
          <Link to="/record/$patientId" params={{ patientId: patient.id }} search={{ section: active?.id }}>
            <Maximize2 className="h-3.5 w-3.5" /> Open full record
          </Link>
        </Button>
      </SheetHeader>

      <div className="mt-4">
        <ReferralStatusTimeline patient={patient} />
      </div>

      <Tabs value={active?.id} onValueChange={setTab} className="mt-4">
        <TabsList className="w-full flex-wrap h-auto">
          {sections.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {active && (
          <TabsContent value={active.id} className="mt-4">
            {active.render()}
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

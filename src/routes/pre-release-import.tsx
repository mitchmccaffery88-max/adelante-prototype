// §Pre-release pipeline — internal staff CSV upload for partner-supplied
// pre-release roster data.
//
// Not a portal for the correctional facility's care manager: that person
// usually works for the facility, not Adelante, and frequently has no account
// here. The real channel is protected email to somebody internal, and this is
// the page that person uses so they are not typing one field at a time.
//
// Preview first — nothing is written until the import is confirmed, and every
// rejected row says exactly why.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import {
  canImportPreReleaseRoster,
  useActingRole,
  useActingStaff,
} from "@/lib/roles";
import {
  PRE_RELEASE_CSV_COLUMNS,
  PRE_RELEASE_IMPORT_NOTE,
  preReleaseCsvTemplate,
  previewPreReleaseRoster,
  rosterCounts,
  type KnownPatient,
  type RosterPreview,
} from "@/lib/preReleaseRoster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AccessDenied } from "@/components/AccessDenied";

export const Route = createFileRoute("/pre-release-import")({
  head: () => ({
    meta: [
      { title: "Pre-release roster import — Adelante" },
      {
        name: "description",
        content:
          "Upload a pre-release roster sent by a correctional facility partner and review every row before anything is saved.",
      },
      { property: "og:title", content: "Pre-release roster import — Adelante" },
      {
        property: "og:description",
        content: "Bulk intake of partner-supplied pre-release episodes, with row-level review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreReleaseImportPage,
});

const OUTCOME_LABEL: Record<string, string> = {
  created: "New record",
  matched: "Existing record",
  skipped: "No change",
};

function PreReleaseImportPage() {
  const role = useActingRole();
  const { staffId, staffName } = useActingStaff();
  const patients = useEhr(() => AdelanteEHR.listPatients());
  const episodes = useEhr(() => AdelanteEHR.listPreReleaseEpisodes());
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [applied, setApplied] = useState(false);
  const downloadRef = useRef<HTMLAnchorElement | null>(null);

  if (!canImportPreReleaseRoster(role)) {
    return (
      <div className="p-6">
        <AccessDenied
          title="Roster import is limited"
          description="Uploading a pre-release roster is limited to reentry and coordination staff."
        />
      </div>
    );
  }

  const known: KnownPatient[] = patients.map((p) => {
    const open = episodes.find((e) => e.patientId === p.id && e.status === "open");
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      ...(p.dob ? { dob: p.dob } : {}),
      ...(open
        ? { openEpisode: { id: open.id, anticipatedReleaseDate: open.anticipatedReleaseDate } }
        : {}),
    };
  });

  const load = async (f: File | undefined) => {
    if (!f) return;
    setApplied(false);
    setFileName(f.name);
    setPreview(previewPreReleaseRoster(await f.text(), known));
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([preReleaseCsvTemplate()], { type: "text/csv" }));
    const a = downloadRef.current;
    if (!a) return;
    a.href = url;
    a.download = "pre-release-roster-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const apply = () => {
    if (!preview) return;
    let created = 0;
    let updated = 0;
    for (const c of preview.candidates) {
      if (c.outcome === "skipped") continue;
      let patientId = c.patientId;
      let episodeId: string | undefined;
      try {
        if (c.outcome === "created") {
          const res = AdelanteEHR.openPreReleaseEpisodeForNewPatient({
            firstName: c.firstName,
            lastName: c.lastName,
            dob: c.dob,
            anticipatedReleaseDate: c.anticipatedReleaseDate,
            cfCareManagerStaffId: staffId,
            cfCareManagerName: staffName,
            ...(c.facilityName ? { facilityName: c.facilityName } : {}),
            ...(c.bookingNumber ? { bookingNumber: c.bookingNumber } : {}),
            openedBy: staffId,
            actorRole: role,
          });
          patientId = res.patient.id;
          episodeId = res.episode.id;
          created += 1;
        } else if (patientId) {
          const existingOpen = episodes.find(
            (e) => e.patientId === patientId && e.status === "open",
          );
          if (existingOpen) {
            AdelanteEHR.updatePreReleaseEpisodeDetails({
              episodeId: existingOpen.id,
              anticipatedReleaseDate: c.anticipatedReleaseDate,
              ...(c.facilityName ? { facilityName: c.facilityName } : {}),
              ...(c.bookingNumber ? { bookingNumber: c.bookingNumber } : {}),
              updatedBy: staffId,
              actorRole: role,
            });
            episodeId = existingOpen.id;
          } else {
            const ep = AdelanteEHR.openPreReleaseEpisode({
              patientId,
              anticipatedReleaseDate: c.anticipatedReleaseDate,
              cfCareManagerStaffId: staffId,
              cfCareManagerName: staffName,
              ...(c.facilityName ? { facilityName: c.facilityName } : {}),
              ...(c.bookingNumber ? { bookingNumber: c.bookingNumber } : {}),
              openedBy: staffId,
              actorRole: role,
            });
            episodeId = ep.id;
          }
          updated += 1;
        }
        if (patientId && c.county) AdelanteEHR.setCountyOfRelease(patientId, c.county);
        if (episodeId && c.hrsn.length > 0) {
          AdelanteEHR.recordImportedHrsnDomains({
            episodeId,
            domains: c.hrsn,
            importedBy: staffId,
            actorRole: role,
          });
        }
      } catch (e) {
        toast.error(`Row ${c.line}: ${(e as Error).message}`);
      }
    }
    setApplied(true);
    setPreview(null);
    toast.success(`Imported ${created} new and ${updated} existing record(s).`);
  };

  const counts = preview ? rosterCounts(preview) : null;
  const writable = preview?.candidates.filter((c) => c.outcome !== "skipped").length ?? 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/pre-release">
            <ArrowLeft className="mr-1 h-4 w-4" /> Pre-release list
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Pre-release roster import</h1>
          <p className="text-sm text-muted-foreground">
            For lists sent over by a correctional facility partner. Everything is shown for review
            first — nothing is saved until you confirm.
          </p>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="file"
            accept=".csv,text/csv"
            className="max-w-sm"
            data-testid="roster-csv-input"
            onChange={(e) => void load(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1 h-4 w-4" /> Template
          </Button>
          <a ref={downloadRef} className="hidden" />
        </div>
        <p className="text-xs text-muted-foreground">
          Columns: {PRE_RELEASE_CSV_COLUMNS.join(", ")}.
        </p>
        <p className="text-xs text-muted-foreground">{PRE_RELEASE_IMPORT_NOTE}</p>
        {fileName && <p className="text-xs text-muted-foreground">File: {fileName}</p>}
      </Card>

      {applied && (
        <Card className="p-4 text-sm" data-testid="roster-applied">
          Import finished. The people you brought in are on the{" "}
          <Link to="/pre-release" className="underline">
            pre-release list
          </Link>
          .
        </Card>
      )}

      {preview?.fatal && (
        <Card className="border-destructive/40 p-4 text-sm text-destructive" data-testid="roster-fatal">
          {preview.fatal}
        </Card>
      )}

      {preview && !preview.fatal && counts && (
        <Card className="space-y-3 p-4" data-testid="roster-preview">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{counts.created} new</Badge>
            <Badge variant="secondary">{counts.matched} existing</Badge>
            <Badge variant="secondary">{counts.skipped} unchanged</Badge>
            <Badge variant={counts.rejected ? "destructive" : "secondary"}>
              {counts.rejected} rejected
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">Row</th>
                  <th className="py-1 pr-3">Name</th>
                  <th className="py-1 pr-3">Release</th>
                  <th className="py-1 pr-3">Needs reported</th>
                  <th className="py-1 pr-3">Outcome</th>
                  <th className="py-1">Why</th>
                </tr>
              </thead>
              <tbody>
                {preview.candidates.map((c) => (
                  <tr key={`c-${c.line}`} className="border-t">
                    <td className="py-1 pr-3">{c.line}</td>
                    <td className="py-1 pr-3">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="py-1 pr-3">{c.anticipatedReleaseDate}</td>
                    <td className="py-1 pr-3">
                      {c.hrsn.length === 0
                        ? "Not screened"
                        : c.hrsn.filter((d) => d.positive).map((d) => d.label).join(", ") ||
                          "None reported"}
                    </td>
                    <td className="py-1 pr-3">{OUTCOME_LABEL[c.outcome]}</td>
                    <td className="py-1 text-muted-foreground">{c.reason}</td>
                  </tr>
                ))}
                {preview.rejections.map((r) => (
                  <tr key={`r-${r.line}`} className="border-t text-destructive">
                    <td className="py-1 pr-3">{r.line}</td>
                    <td className="py-1 pr-3">{r.name}</td>
                    <td className="py-1 pr-3">—</td>
                    <td className="py-1 pr-3">—</td>
                    <td className="py-1 pr-3">Rejected</td>
                    <td className="py-1">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button data-testid="roster-apply" disabled={writable === 0} onClick={apply}>
              <Upload className="mr-1 h-4 w-4" /> Import {writable} row(s)
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

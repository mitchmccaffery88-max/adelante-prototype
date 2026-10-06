import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { STAFF_ROLES, useActingStaff } from "@/lib/roles";
import { canViewCoordination } from "@/lib/coordinationRoles";
import { REGISTRY_VERSION, type ChartActionGroup } from "@/lib/chartActions";
import { featureSnapshot } from "@/lib/features";
import { flagsCsv, matrixCsv, permissionMatrix } from "@/lib/actions/permissionMatrix";
import { ACTION_EVENTS } from "@/lib/actions/runAction";
import { redactAuditEvent } from "@/lib/auditRedaction";
import { noteContentByRole } from "@/lib/actions/permissionMatrix";
import { NOTE_CONTENT_RBAC_DRAFT } from "@/lib/roles";
import { SUD_REPORTING_ACCESS_LABEL, SUD_REPORTING_ACCESS_ROLES, SUD_REPORTING_POST_MVP_NOTE } from "@/lib/sudReportingAccess";

export const Route = createFileRoute("/admin-permissions")({
  head: () => ({
    meta: [
      { title: "Permissions & features — Adelante" },
      { name: "description", content: "Who can take each action, which checks and audit events apply, and which features are on." },
      { property: "og:title", content: "Permissions & features — Adelante" },
      { property: "og:description", content: "Role by action matrix, feature flags and recent action audit events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PermissionsPage,
});

const GROUPS: ChartActionGroup[] = ["document", "clinical", "care", "coordination", "visit", "billing", "admin"];
const STATE_LABEL = { allowed: "Allowed", cosign: "Cosign", hidden: "Hidden" } as const;
const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function PermissionsPage() {
  const { role } = useActingStaff();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [feedRole, setFeedRole] = useState<string>("all");
  const [search, setSearch] = useState("");
  const matrix = useMemo(() => permissionMatrix(), []);
  const events = useEhr(() => AdelanteEHR.listAuditEvents({ category: "action", limit: 300 }));
  if (!canViewCoordination(role)) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Card className="p-6 text-sm text-muted-foreground">Permissions & features is available to system administrators and clinical coordinators.</Card>
      </main>
    );
  }
  const rows = matrix.filter(
    (r) =>
      (roleFilter === "all" || r.role === roleFilter) &&
      (groupFilter === "all" || r.group === groupFilter) &&
      (!search.trim() || `${r.label} ${r.actionId}`.toLowerCase().includes(search.toLowerCase())),
  );
  const feed = events.filter((e) => (eventFilter === "all" || e.action === eventFilter) && (feedRole === "all" || e.actorRole === feedRole));
  const roleLabel = (k: string) => STAFF_ROLES.find((r) => r.key === k)?.label ?? k;
  const csvName = (kind: string) => `${kind}${roleFilter !== "all" ? `-${roleFilter}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-navy">Permissions & features</h1>
        <p className="text-sm text-muted-foreground">
          Every action comes from one list (version {REGISTRY_VERSION}). Each attempt writes one audit event: {ACTION_EVENTS.join(", ")}. Read-only.
        </p>
      </header>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="mr-auto text-lg font-medium text-navy">Role × action</h2>
          <label className="text-xs">
            Role{" "}
            <select aria-label="Filter by role" className={selectCls} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              {STAFF_ROLES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Group{" "}
            <select aria-label="Filter by group" className={selectCls} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">All groups</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <Input aria-label="Search actions" className="h-9 w-44" placeholder="Search actions" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => download(csvName("permissions-matrix"), matrixCsv(rows))}>
            <Download className="mr-1 h-4 w-4" /> Matrix CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => download(csvName("feature-flags"), flagsCsv())}>
            <Download className="mr-1 h-4 w-4" /> Flags CSV
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Checked without a specific patient: consent-gated access shows as hidden until a patient's consent is on file. {rows.length} rows.</p>
        <div className="max-h-[60vh] overflow-auto rounded-md border">
          <table className="w-full text-left text-xs" data-testid="permissions-matrix">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="p-2">Role</th>
                <th className="p-2">Action</th>
                <th className="p-2">Group</th>
                <th className="p-2">Outcome</th>
                <th className="p-2">Check</th>
                <th className="p-2">Audit events</th>
                <th className="p-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.role}:${r.actionId}`} className="border-t">
                  <td className="p-2">{roleLabel(r.role)}</td>
                  <td className="p-2 font-medium">{r.label}<span className="block font-mono text-[10px] text-muted-foreground">{r.actionId}</span></td>
                  <td className="p-2">{r.group}</td>
                  <td className="p-2">
                    <Badge variant={r.state === "allowed" ? "default" : r.state === "cosign" ? "secondary" : "outline"}>{STATE_LABEL[r.state]}</Badge>
                  </td>
                  <td className="p-2 font-mono text-[10px]">{r.check}</td>
                  <td className="p-2 font-mono text-[10px]">{r.events}</td>
                  <td className="p-2 font-mono text-[10px]">{r.flags || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-2 p-4" data-testid="capabilities">
        <h2 className="text-lg font-medium text-navy">Capabilities</h2>
        <div className="flex flex-wrap items-start gap-2 border-t py-2 text-sm" data-testid="capability-sud-reporting">
          <span className="w-40 font-medium">{SUD_REPORTING_ACCESS_LABEL}</span>
          <span className="min-w-0 flex-1">
            Client-level county reporting only: CalOMS fields and blockers, DMC-ODS export rows, TPS client list, returned CalOMS error detail. Never notes, therapy content, ASAM narrative or ratings, care plans or medication detail.
            <span className="block text-xs text-muted-foreground">Holders: {SUD_REPORTING_ACCESS_ROLES.map((r) => STAFF_ROLES.find((x) => x.key === r)?.label ?? r).join(", ")}</span>
            <span className="block text-xs text-muted-foreground" data-testid="sud-reporting-post-mvp">{SUD_REPORTING_POST_MVP_NOTE}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-start gap-2 border-t py-2 text-sm" data-testid="capability-note-content">
          <span className="w-40 font-medium">Clinical-note content</span>
          <span className="min-w-0 flex-1">
            Metadata only (date, note type, author, signed status, linked visit) — no body of therapy, psychiatric or counseling notes, scribe drafts or transcripts. Own and coordination notes stay fully readable.
            <span className="block text-xs text-muted-foreground">Metadata-only roles: {Object.entries(noteContentByRole()).filter(([, v]) => v === "metadata").map(([r]) => STAFF_ROLES.find((x) => x.key === r)?.label ?? r).join(", ") || "none"}</span>
            <span className="block text-xs text-muted-foreground">{NOTE_CONTENT_RBAC_DRAFT}</span>
          </span>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-lg font-medium text-navy">Feature flags</h2>
        <ul className="divide-y text-sm" data-testid="feature-flags">
          {featureSnapshot().map(({ flag, value }) => (
            <li key={flag.id} className="flex flex-wrap items-start gap-2 py-2">
              <span className="w-40 font-mono text-xs">{flag.id}</span>
              <span className="min-w-0 flex-1">{flag.description}<span className="block text-xs text-muted-foreground">Owner: {flag.owner} · Scope: {flag.scope} · Default: {flag.default ? "on" : "off"}</span></span>
              {flag.simulated && <Badge variant="secondary" data-testid={`simulated-${flag.id}`}>Simulated</Badge>}
              <Badge variant={value ? "default" : "outline"}>{value ? "On" : "Off"}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="mr-auto text-lg font-medium text-navy">Recent action events</h2>
          <select aria-label="Filter events by outcome" className={selectCls} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
            <option value="all">All events</option>
            {ACTION_EVENTS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <select aria-label="Filter events by role" className={selectCls} value={feedRole} onChange={(e) => setFeedRole(e.target.value)}>
            <option value="all">All roles</option>
            {STAFF_ROLES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action events yet in this session.</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <table className="w-full text-left text-xs" data-testid="action-audit-feed">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="p-2">When</th>
                  <th className="p-2">Event</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Who</th>
                  <th className="p-2">Patient</th>
                  <th className="p-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((e) => {
                  const d = e.detail ?? {};
                  const red = redactAuditEvent(e, role);
                  return (
                    <tr key={e.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                      <td className="p-2"><Badge variant={e.action === "action.blocked" ? "destructive" : "secondary"}>{e.action}</Badge></td>
                      <td className="p-2 font-mono text-[10px]">{String(d["actionId"] ?? "")}</td>
                      <td className="p-2">{roleLabel(String(d["actingRole"] ?? e.actorRole ?? ""))} · {String(d["actorId"] ?? "")}{d["viewingStaffId"] ? ` (viewing ${String(d["viewingStaffId"])})` : ""}</td>
                      <td className="p-2 font-mono text-[10px]">{red.subjectLabel}</td>
                      <td className="p-2">{String(d["reason"] ?? d["outcome"] ?? "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}

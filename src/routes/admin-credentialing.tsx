import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { AdelanteEHRExt, useEhrExt } from "@/lib/ehr-ext";

export const Route = createFileRoute("/admin-credentialing")({
  head: () => ({
    meta: [
      { title: "Credentialing Dashboard — Adelante" },
      { name: "description", content: "Verify licenses, DEA, malpractice, and payer enrollments." },
    ],
  }),
  component: CredentialingAdminPage,
});

const statusStyle: Record<string, string> = {
  current: "bg-success/20 text-success",
  expiring: "bg-gold/20 text-navy",
  expired: "bg-destructive/15 text-destructive",
  missing: "bg-destructive/15 text-destructive",
  under_review: "bg-muted text-muted-foreground",
};

function CredentialingAdminPage() {
  const clinicians = useEhr(() => AdelanteEHR.listClinicians());
  const creds = useEhrExt(() => AdelanteEHRExt.listAllCredentials());
  const enrollments = useEhrExt(() => AdelanteEHRExt.listAllEnrollments());

  const expiringSoon = creds.filter((c) => c.status === "expiring" || c.status === "expired" || c.status === "missing");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy">Credentialing dashboard</h1>
          <p className="text-sm text-muted-foreground">Primary-source verification, expiry tracking, and payer enrollments.</p>
        </div>
        <Link to="/admin" className="text-sm underline">← Admin</Link>
      </header>

      {expiringSoon.length > 0 && (
        <Card className="p-4 border-destructive/40 bg-destructive/5">
          <h2 className="font-semibold text-destructive mb-2">Action needed ({expiringSoon.length})</h2>
          <ul className="space-y-1 text-sm">
            {expiringSoon.map((c) => {
              const cl = clinicians.find((x) => x.id === c.clinicianId);
              return (
                <li key={c.id} className="flex items-center justify-between">
                  <span>
                    <b>{cl?.name}</b> — {c.kind} {c.expiresAt ? `· expires ${c.expiresAt}` : "· missing expiry"}
                  </span>
                  <Badge className={statusStyle[c.status]}>{c.status}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-2">All credentials</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">Clinician</th><th>Kind</th><th>#</th><th>Expires</th><th>Status</th><th>Verified</th><th></th></tr>
            </thead>
            <tbody className="divide-y">
              {creds.map((c) => {
                const cl = clinicians.find((x) => x.id === c.clinicianId);
                return (
                  <tr key={c.id} className="py-1">
                    <td className="py-2">{cl?.name}</td>
                    <td>{c.kind}</td>
                    <td>{c.number ?? "—"}</td>
                    <td>{c.expiresAt ?? "—"}</td>
                    <td><Badge className={statusStyle[c.status]}>{c.status}</Badge></td>
                    <td>{c.verifiedAt ? "✓" : "—"}</td>
                    <td className="text-right">
                      {!c.verifiedAt && (
                        <Button size="sm" variant="outline" onClick={() => { AdelanteEHRExt.verifyCredential(c.id, "credentialing_coordinator"); toast.success("Verified via primary source"); }}>
                          Verify
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2">Payer enrollments</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">Clinician</th><th>Payer</th><th>TIN</th><th>Status</th><th>Effective</th></tr>
            </thead>
            <tbody className="divide-y">
              {enrollments.map((e) => {
                const cl = clinicians.find((x) => x.id === e.clinicianId);
                return (
                  <tr key={e.id}>
                    <td className="py-2">{cl?.name}</td>
                    <td>{e.payer}</td>
                    <td>{e.billingTin}</td>
                    <td><Badge variant="outline">{e.status}</Badge></td>
                    <td>{e.effectiveFrom ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
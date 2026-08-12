// §Front door — staff queue for NON-clinical community inquiries.
//
// These are not patients and this is not a chart. The queue exists so the
// page's promise ("someone will point you in the right direction") is real:
// every row carries a required contact detail and a two-step disposition
// (contacted → resolved). Crisis-flagged rows sort to the top and also raised
// a real anonymous crisis alert on the crisis queue at capture time.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, type CommunityInquiry } from "@/lib/ehr";
import { canAccess, useActingStaff } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientDate } from "@/components/ClientDate";
import { EmptyState } from "@/components/EmptyState";
import { MessageSquare, Phone, Mail, Siren } from "lucide-react";

export function CommunityInquiryQueue() {
  const { role, staffName } = useActingStaff();
  const canWrite = canAccess(role, "community_inquiries").level === "write";
  const rows = useEhr(() => AdelanteEHR.listCommunityInquiries({ includeResolved: true }));
  const [showResolved, setShowResolved] = useState(false);

  const visible = useMemo(() => {
    const list = rows.filter((r) => showResolved || r.status !== "resolved");
    return [...list].sort((a, b) => {
      if (a.crisisFlagged !== b.crisisFlagged) return a.crisisFlagged ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [rows, showResolved]);

  const disposition = (r: CommunityInquiry, status: "contacted" | "resolved") => {
    const ok = AdelanteEHR.dispositionCommunityInquiry(r.id, status, staffName);
    toast[ok ? "success" : "error"](ok ? `Marked ${status}.` : "Already in that state.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Front-door notes from people who are not patients. Nothing here is a chart entry — do not
          copy this text into a record.
        </p>
        <Button size="sm" variant="ghost" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? "Hide resolved" : "Show resolved"}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No open inquiries" />
      ) : (
        visible.map((r) => (
          <Card key={r.id} className="space-y-3 p-4" data-testid="community-inquiry-row">
            <div className="flex flex-wrap items-center gap-2">
              {r.crisisFlagged ? (
                <Badge variant="destructive" className="gap-1">
                  <Siren className="h-3 w-3" /> Crisis language
                </Badge>
              ) : null}
              <Badge variant={r.status === "new" ? "default" : "outline"}>{r.status}</Badge>
              <span className="text-xs text-muted-foreground">
                <ClientDate value={r.createdAt} withTime />
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-navy">{r.body}</p>
            <div className="flex items-center gap-2 text-sm">
              {r.contactKind === "email" ? (
                <Mail className="h-4 w-4 text-teal" />
              ) : (
                <Phone className="h-4 w-4 text-teal" />
              )}
              <a
                className="font-medium underline"
                href={r.contactKind === "email" ? `mailto:${r.contact}` : `tel:${r.contact}`}
              >
                {r.contact}
              </a>
            </div>
            {r.dispositionBy ? (
              <p className="text-xs text-muted-foreground">
                {r.status} by {r.dispositionBy} · <ClientDate value={r.dispositionAt!} withTime />
              </p>
            ) : null}
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={r.status !== "new"}
                  onClick={() => disposition(r, "contacted")}
                >
                  Mark contacted
                </Button>
                <Button
                  size="sm"
                  disabled={r.status === "resolved"}
                  onClick={() => disposition(r, "resolved")}
                >
                  Mark resolved
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Read-only for your role.</p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

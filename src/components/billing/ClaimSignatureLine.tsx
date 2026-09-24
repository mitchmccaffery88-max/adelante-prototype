// §Phase 7b.1 — "Signed from note … by … on …" for a billing reviewer.
import { Link } from "@tanstack/react-router";
import { AdelanteEHRExt, type Claim } from "@/lib/ehr-ext";

export function ClaimSignatureLine({ claim }: { claim: Claim }) {
  if (claim.state === "documented") return null;
  const sig = AdelanteEHRExt.claimSignature(claim);
  if (!sig) return null;
  if (sig === "seed")
    return (
      <p className="mt-1 text-[10px] text-muted-foreground" data-testid="claim-signature-seed">
        Seed data — no note signature
      </p>
    );
  return (
    <p className="mt-1 text-[10px] text-muted-foreground" data-testid="claim-signature">
      {sig.cosign ? "Cosigned" : "Signed"} from{" "}
      <Link
        to="/record/$patientId"
        params={{ patientId: claim.patientId }}
        className="underline underline-offset-2 text-navy"
      >
        note {sig.noteId.slice(0, 8)}
      </Link>{" "}
      by {sig.signerName} ({safeRole(sig.signerRole)}) on {new Date(sig.signedAt).toLocaleDateString()}
      {sig.authorName ? ` · written by ${sig.authorName}` : ""} · {sig.statementKey} {sig.statementVersion}
    </p>
  );
}

function safeRole(r: string): string {
  return r.replace(/_/g, " ");
}

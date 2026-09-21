// §EHR audit Phase 1d — the consolidated "what is blocking this signature"
// list, generalizing the ordered `refusalFinalizeProblems()` display. Takes
// plain `SignBlocker` rows, so any consumer of the attestation primitive can
// render the same thing.
import type { SignBlocker } from "@/lib/attestation";

export function SignBlockerList({
  blockers,
  title = "Before you can sign",
}: {
  blockers: SignBlocker[];
  title?: string;
}) {
  if (blockers.length === 0) return null;
  return (
    <div
      data-testid="sign-blocker-list"
      className="rounded border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive"
    >
      <p className="font-medium">
        {title} ({blockers.length})
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {blockers.map((b) => (
          <li key={b.code} data-blocker-code={b.code}>
            {b.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

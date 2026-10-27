import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/ui/status-chip";
import { AdelanteEHR, useEhr } from "@/lib/ehr";
import { runAction } from "@/lib/actions/runAction";
import { activeInviteFor, canSendSignupInvite, contactOnFile, INVITE_DEFAULT_TIMING, INVITE_TTL_DAYS, listInviteOutbox, maskContact, type InviteTiming } from "@/lib/signupInvite";
import type { StaffRole } from "@/lib/roles";

type Actor = { role: StaffRole; staffId?: string; staffName?: string };

/**
 * 27 Oct (Mitch) — "Send sign-up invite", visit reminders that reuse the same
 * link, and in-person tablet setup. Draft. Delivery is Simulated: the demo
 * panel shows testers the link; nothing claims a message was delivered.
 */
export function SignupInviteControls({ actor, referralId, reason }: { actor: Actor; referralId: string; reason: string }) {
  const r = useEhr(() => AdelanteEHR.listReferrals().find((x) => x.id === referralId));
  const [timing, setTiming] = useState<InviteTiming>(INVITE_DEFAULT_TIMING);
  const [when, setWhen] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [tick, setTick] = useState(0);
  if (!r || !canSendSignupInvite(actor.role) || !(r.status === "submitted" || r.status === "contacted")) return null;
  const contact = contactOnFile(r);
  const active = activeInviteFor(referralId);
  const last = listInviteOutbox(referralId).at(-1);
  const reasonOk = reason.trim().length >= 3;
  void tick;
  const run = (id: string, args: unknown[], done: string) => {
    const out = runAction<{ scheduledFor?: string; reused?: boolean }>(id, actor, undefined, { args: [actor, ...args], auditReason: reason });
    if (!out.ok) toast.error(out.reason);
    else toast.success(done, { description: out.value?.reused ? "Same link resent — still valid." : out.value?.scheduledFor ? `Scheduled for release date ${out.value.scheduledFor}.` : undefined });
    setTick((n) => n + 1);
  };
  return (
    <div className="w-full space-y-2 rounded-md border border-line-strong p-3" data-testid="signup-invite-controls">
      <div className="flex flex-wrap items-center gap-2">
        <strong>Sign-up invite</strong>
        <StatusChip state="simulated" label="Simulated — no text or email is sent" />
        <span className="text-sm text-ink-muted">Draft — link valid {INVITE_TTL_DAYS} days, single use.</span>
      </div>
      {!contact ? (
        <p className="text-sm text-ink-muted">No phone or email on file. Confirm identity in person and set up on a clinic tablet.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`invite-timing-${referralId}`}>When to send</Label>
            <select id={`invite-timing-${referralId}`} className="h-9 rounded-sm border border-line-strong bg-surface px-2" value={timing} onChange={(e) => setTiming(e.target.value as InviteTiming)}>
              <option value="release">On release date (Draft default)</option>
              <option value="now">Now</option>
            </select>
          </div>
          <Button variant="outline" disabled={!reasonOk} onClick={() => run("signup_invite_send", [referralId, { timing }, reason], active ? "Invite resent" : "Invite queued")}>
            {active ? "Resend sign-up invite" : "Send sign-up invite"}
          </Button>
          <span className="text-sm text-ink-muted">Goes to the contact on file: {maskContact(contact.key)}</span>
        </div>
      )}
      {active && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`invite-when-${referralId}`}>Visit (for the reminder)</Label>
            <Input id={`invite-when-${referralId}`} placeholder="Tue 10am" value={when} onChange={(e) => setWhen(e.target.value)} className="max-w-[12rem]" />
          </div>
          <Button variant="ghost" disabled={!reasonOk || !when.trim()} onClick={() => run("signup_invite_remind", [referralId, when.trim(), reason], "Reminder queued with the same link")}>Send visit reminder</Button>
        </div>
      )}
      {r.identityConfirmedBy?.at && (
        <div className="flex flex-wrap items-end gap-2" data-testid="in-person-setup">
          <span className="text-sm">Identity confirmed by {r.identityConfirmedBy.name || r.identityConfirmedBy.role} — {r.identityConfirmedBy.how}</span>
          <div className="space-y-1"><Label htmlFor={`pin-${referralId}`}>PIN they choose</Label><Input id={`pin-${referralId}`} type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} className="max-w-[8rem]" /></div>
          <div className="space-y-1"><Label htmlFor={`pin2-${referralId}`}>PIN again</Label><Input id={`pin2-${referralId}`} type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value)} className="max-w-[8rem]" /></div>
          <Button variant="outline" disabled={!reasonOk || !pin} onClick={() => { run("signup_in_person_setup", [referralId, { credential: pin, confirm: pin2 }, reason], "Set up on clinic tablet"); setPin(""); setPin2(""); }}>Set up on clinic tablet</Button>
        </div>
      )}
      {last && (
        <details className="text-sm">
          <summary>Demo panel (testers only) — last {last.kind} to {last.contactMask}</summary>
          <p>{last.text.en}</p>
          <a className="text-path underline" href={last.link} data-testid="invite-demo-link">{last.link}</a>
        </details>
      )}
    </div>
  );
}

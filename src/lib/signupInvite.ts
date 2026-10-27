// 27 Oct (Mitch) — sign-up invite links. Draft — pending EHR/Admin audit.
//
// One possession check at most. A staff "Send sign-up invite" sends a link to
// the phone or email ALREADY ON FILE in the referral. Tapping it counts as
// holding that contact; last name + date of birth then confirm it's the right
// person. Reminders reuse the same link while it is valid — never a second
// verification.
//
// Tokens are single-use, valid INVITE_TTL_DAYS, rate-limited, and stored only
// as a SHA-256 hash. Delivery is Simulated: the raw link lives only in the
// simulated outbox (what a real SMS/email provider queue would hold), which
// testers see in the demo panel. Nothing here claims a message left the
// building. Preview-memory only (persistence is Phase 2d).
import { AdelanteEHR, type Referral } from "./ehr";
import { getStaffMember, type StaffRole } from "./roles";
import { emailKey, phoneKey } from "./signupMatch";
import { lifecycleEnrollReferral } from "./referralLifecycleActions";
import { credentialMeta, validateCredentialOnly } from "./signup";

/** Draft settings — pending Mitch/Christi sign-off. */
export const INVITE_TTL_DAYS = 14;
export const INVITE_SENDS_PER_DAY = 3;
export const INVITE_SEND_SPACING_MS = 60 * 1000;
export const INVITE_IDENTITY_TRY_LIMIT = 5;
export type InviteTiming = "now" | "release";
/** Draft default: "on release date". */
export const INVITE_DEFAULT_TIMING: InviteTiming = "release";

export type InviteChannel = "sms" | "email";
export type InviteRecord = {
  id: string;
  referralId: string;
  tokenHash: string;
  channel: InviteChannel;
  issuedAt: number;
  expiresAt: number;
  consumedAt?: number;
  identityTries: number;
  timing: InviteTiming;
  scheduledFor?: string;
};
export type InviteOutboxItem = {
  id: string;
  inviteId: string;
  referralId: string;
  kind: "invite" | "reminder" | "resend";
  channel: InviteChannel;
  contactMask: string;
  /** Raw link, preview demo panel only. A real provider queue holds the message body. */
  link: string;
  text: { en: string; es: string };
  at: number;
  scheduledFor?: string;
  simulated: true;
};

const invites = new Map<string, InviteRecord>();
const byHash = new Map<string, string>();
const outbox: InviteOutboxItem[] = [];
const sends = new Map<string, number[]>();

// ---------------------------------------------------------------- SHA-256 (sync)
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total); buf.set(bytes); buf[len] = 0x80;
  const view = new DataView(buf.buffer); view.setUint32(total - 4, len * 8); view.setUint32(total - 8, Math.floor(len / 0x20000000));
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + w[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

// ---------------------------------------------------------------- helpers
export type InviteActor = { role: StaffRole; staffId?: string; staffName?: string };
/** Intake Coordinator, care managers (ECM, CF) and clinical coordinator. */
export const INVITE_SENDER_ROLES: StaffRole[] = ["intake_coordinator", "ecm_provider", "cf_care_manager", "clinical_coordinator"];
export const canSendSignupInvite = (role: StaffRole) => INVITE_SENDER_ROLES.includes(role);
export const INVITE_DENIED = "Sign-up invites are sent by Intake, care managers and the clinical coordinator.";
export const IN_PERSON_NEEDED = "Record identity confirmed in person first (who, when, how).";

export function maskContact(contact: string): string {
  if (!contact) return "";
  if (contact.includes("@")) { const [u, d] = contact.split("@"); return `${u.slice(0, 1)}•••@${d}`; }
  return `•••• ${contact.replace(/\D/g, "").slice(-4)}`;
}
export function contactOnFile(r: Pick<Referral, "phone" | "email">): { channel: InviteChannel; key: string } | undefined {
  const p = phoneKey(r.phone ?? ""); if (p) return { channel: "sms", key: p };
  const e = emailKey(r.email ?? ""); if (e && e.includes("@")) return { channel: "email", key: e };
  return undefined;
}
const referralOf = (id: string) => AdelanteEHR.listReferrals().find((r) => r.id === id);
const isOpen = (r?: Referral) => !!r && (r.status === "submitted" || r.status === "contacted");
function randomToken() { const a = crypto.getRandomValues(new Uint8Array(24)); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); }
export const inviteLink = (token: string) => `/start/invite/${token}`;

export function inviteStatus(inv: InviteRecord | undefined, now = Date.now()): "valid" | "expired" | "used" | "unknown" {
  if (!inv) return "unknown";
  if (inv.consumedAt) return "used";
  if (now >= inv.expiresAt) return "expired";
  return "valid";
}
export function activeInviteFor(referralId: string, now = Date.now()) {
  return [...invites.values()].filter((i) => i.referralId === referralId && inviteStatus(i, now) === "valid").sort((a, b) => b.issuedAt - a.issuedAt)[0];
}
export const listInvitesForReferral = (referralId: string) => [...invites.values()].filter((i) => i.referralId === referralId);
export const listInviteOutbox = (referralId?: string) => outbox.filter((o) => !referralId || o.referralId === referralId);
function sendAllowed(referralId: string, now: number) {
  const t = (sends.get(referralId) ?? []).filter((x) => now - x < 86_400_000);
  if (t.length && now - t[t.length - 1] < INVITE_SEND_SPACING_MS) return false;
  return t.length < INVITE_SENDS_PER_DAY;
}
function noteSend(referralId: string, now: number) { const t = sends.get(referralId) ?? []; t.push(now); sends.set(referralId, t); }

const COPY = {
  invite: { en: "Your Adelante team is ready for you. Tap to get started: {link}", es: "Tu equipo de Adelante está listo para ti. Toca para empezar: {link}" },
  reminder: { en: "Start your intake before your visit on {when}: {link}", es: "Empieza tu admisión antes de tu cita el {when}: {link}" },
};

function lastLinkFor(inviteId: string) { return [...outbox].reverse().find((o) => o.inviteId === inviteId)?.link; }

function deliver(inv: InviteRecord, r: Referral, kind: InviteOutboxItem["kind"], link: string, now: number, when?: string) {
  const c = contactOnFile(r)!;
  const tpl = kind === "reminder" ? COPY.reminder : COPY.invite;
  const fill = (s: string) => s.replace("{link}", link).replace("{when}", when ?? "");
  const item: InviteOutboxItem = { id: crypto.randomUUID(), inviteId: inv.id, referralId: r.id, kind, channel: c.channel, contactMask: maskContact(c.key), link, text: { en: fill(tpl.en), es: fill(tpl.es) }, at: now, scheduledFor: kind === "reminder" ? undefined : inv.scheduledFor, simulated: true };
  outbox.push(item);
  return item;
}

function issue(r: Referral, timing: InviteTiming, now: number) {
  const c = contactOnFile(r);
  if (!c) throw new Error("No phone or email on file for this referral.");
  const token = randomToken();
  const today = new Date(now).toISOString().slice(0, 10);
  const scheduledFor = timing === "release" && r.releaseDate && r.releaseDate > today ? r.releaseDate : undefined;
  const inv: InviteRecord = { id: `inv-${crypto.randomUUID().slice(0, 8)}`, referralId: r.id, tokenHash: sha256Hex(token), channel: c.channel, issuedAt: now, expiresAt: now + INVITE_TTL_DAYS * 86_400_000, identityTries: 0, timing, scheduledFor };
  invites.set(inv.id, inv); byHash.set(inv.tokenHash, inv.id);
  return { inv, token };
}

// ---------------------------------------------------------------- staff registry targets

/** `signup_invite_send` — reuses a still-valid link instead of minting a second one. */
export function sendSignupInvite(actor: InviteActor, referralId: string, opts: { timing?: InviteTiming } = {}, reason = "", now = Date.now()) {
  if (!canSendSignupInvite(actor.role)) throw new Error(INVITE_DENIED);
  if (!reason || reason.trim().length < 3) throw new Error("Give a reason.");
  const r = referralOf(referralId);
  if (!isOpen(r) || !r) throw new Error("This referral is closed.");
  if (!r.consentToContact) throw new Error("No consent to contact on file.");
  if (!sendAllowed(referralId, now)) throw new Error("Too many invites sent recently. Try again later.");
  const existing = activeInviteFor(referralId, now);
  const link = existing ? lastLinkFor(existing.id) : undefined;
  let inv: InviteRecord, url: string, reused = false;
  if (existing && link) { inv = existing; url = link; reused = true; }
  else { const out = issue(r, opts.timing ?? INVITE_DEFAULT_TIMING, now); inv = out.inv; url = inviteLink(out.token); }
  noteSend(referralId, now);
  const item = deliver(inv, r, reused ? "resend" : "invite", url, now);
  return { referralId, inviteId: inv.id, reused, scheduledFor: inv.scheduledFor, contactMask: item.contactMask, simulated: true as const };
}

/** `signup_invite_remind` — appointment reminders reuse the same valid link; never a second verification. */
export function sendInviteReminder(actor: InviteActor, referralId: string, when: string, reason = "", now = Date.now()) {
  if (!canSendSignupInvite(actor.role)) throw new Error(INVITE_DENIED);
  if (!reason || reason.trim().length < 3) throw new Error("Give a reason.");
  const r = referralOf(referralId);
  const inv = activeInviteFor(referralId, now);
  const link = inv ? lastLinkFor(inv.id) : undefined;
  if (!r || !inv || !link) throw new Error("No valid invite to remind about. Send a new invite.");
  const item = deliver(inv, r, "reminder", link, now, when);
  return { referralId, inviteId: inv.id, contactMask: item.contactMask, simulated: true as const };
}

/** `signup_in_person_setup` — staff-assisted setup on a clinic tablet; needs in-person identity confirmation. */
export function inPersonSignupSetup(actor: InviteActor, referralId: string, pin: { credential: string; confirm: string }, reason = "") {
  if (!canSendSignupInvite(actor.role)) throw new Error(INVITE_DENIED);
  const r = referralOf(referralId);
  if (!r) throw new Error("Referral unavailable.");
  if (!r.identityConfirmedBy?.at) throw new Error(IN_PERSON_NEEDED);
  if (Object.keys(validateCredentialOnly({ credentialKind: "pin", credential: pin.credential, credentialConfirm: pin.confirm })).length) throw new Error("Choose a PIN of 4 to 6 numbers and type it twice.");
  const out = lifecycleEnrollReferral(actor, referralId, reason);
  if (!out.patientId) throw new Error("Could not finish setup. Send it to Identity review.");
  const p = AdelanteEHR.getPatient(out.patientId);
  if (p) p.signupCredential = credentialMeta("pin");
  AdelanteEHR._emit();
  return { referralId, patientId: out.patientId, confirmedBy: getStaffMember(actor.staffId)?.name ?? r.identityConfirmedBy.name };
}

// ---------------------------------------------------------------- public side (called only from signupStore)

export function _inviteByToken(token: string) { const id = byHash.get(sha256Hex(token)); return id ? invites.get(id) : undefined; }
export const _inviteById = (id: string) => invites.get(id);
export const _inviteReferral = (inv: InviteRecord) => referralOf(inv.referralId);
export function _consumeInvite(inv: InviteRecord, now = Date.now()) { inv.consumedAt = now; }
/** Public "Send me a new link": goes ONLY to the contact on file, rate-limited; result is generic. */
export function _resendFromToken(token: string, now = Date.now()) {
  const old = _inviteByToken(token);
  const r = old ? referralOf(old.referralId) : undefined;
  if (!old || !r || !isOpen(r) || !contactOnFile(r) || !sendAllowed(r.id, now)) return { sent: false as const };
  const valid = activeInviteFor(r.id, now);
  const link = valid ? lastLinkFor(valid.id) : undefined;
  let inv: InviteRecord, url: string;
  if (valid && link) { inv = valid; url = link; } else { const out = issue(r, "now", now); inv = out.inv; url = inviteLink(out.token); }
  noteSend(r.id, now);
  const item = deliver(inv, r, "resend", url, now);
  return { sent: true as const, inviteId: inv.id, referralId: r.id, contactMask: item.contactMask, demoLink: url };
}

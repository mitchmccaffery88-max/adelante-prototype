import { AdelanteEHR, type Referral } from '../ehr';
import type { ChartActor } from '../chartActions';
import type { StaffRole } from '../roles';
import { credentialMeta, normalizeEnrollmentCode, type CredentialKind } from '../signup';
import { attemptsAllowed, codeIdentityMatches, duplicateDecision, emailKey, phoneKey, nameKey, publicReferralResembles, sameIdentity, otpAllowed, OTP_RESEND_MS, paperCodeMatches, verifiedContactReferralMatches, type SignupIdentity } from '../signupMatch';
import { consumeReferralClaimCode, createIdentityReviewItem, referralClaimCodeFor, type IdentityReviewSource, type IdentityReviewType } from '../identityReview';
import { _consumeInvite, _inviteById, _inviteByToken, _inviteReferral, _resendFromToken, contactOnFile, INVITE_IDENTITY_TRY_LIMIT, inviteStatus, maskContact } from '../signupInvite';
export const signupActor: ChartActor = { role: 'public_signup' as StaffRole };
export function canUseSignup(actor: ChartActor) { return actor.role === signupActor.role && !actor.staffId && !actor.clinicianId; }
type Draft = SignupIdentity & { preferredLanguage: 'en'|'es'; credentialKind: CredentialKind; source?: string; helperName?: string };
type ContactOtp = { code: string; contact: string; channel: 'sms'|'email'; at: number; tries: number; used: boolean };
type Session = { id: string; draft?: Draft; times: number[]; otp?: ContactOtp; verified?: { contact: string; how: 'code'|'invite' }; invite?: { id: string; tries: number }; inviteTokenHashSeen?: boolean; patientId?: string };
const sessions = new Map<string, Session>();
// One in-memory device context, separately keyed by entered identity; never audited.
const deviceAttempts = new Map<string, number[]>();
/**
 * 27 Oct (Mitch) redesign — one possession check at most. Draft.
 * - invite_*: tapping the staff invite link proves the contact on file; last name + DOB confirm the person.
 * - send_code / verify_code: the not-invited path verifies the contact the person typed (required for an account).
 * - finish/retry with path 'code': paper RE-code + last name + DOB.
 * - set_signin / referral_source: after setup; no more gates.
 * Account creation is impossible without a verified contact (staff in-person setup lives in signupInvite).
 */
export type SignupCommand = { operation: 'start'|'step'|'save'|'finish'|'retry'|'resend'|'verify'|'continue'|'send_code'|'verify_code'|'invite_open'|'invite_identity'|'invite_continue'|'invite_resend'|'invite_lost'|'set_signin'|'referral_source'; sessionId?: string; draft?: Draft; stepId?: string; path?: 'code'|'no_code'|'new'; code?: string; otp?: string; channel?: 'sms'|'email'; token?: string; lastName?: string; dob?: string; firstName?: string; credentialKind?: CredentialKind; remember?: boolean; source?: string };
export type SignupOutcome = 'started'|'saved'|'step'|'verify'|'mismatch'|'blocked'|'matched'|'new'|'verify_required'|'invite_identity'|'invite_mismatch'|'invite_expired'|'invite_resent'|'invite_lost'|'signin_set';
export type SignupResult = { sessionId: string; outcome: SignupOutcome; patientId?: string; demoCode?: string; demoLink?: string; contactMask?: string; resendAt?: number; limited?: boolean; event: ReturnType<typeof AdelanteEHR._recordAudit> };
function event(action: string, s: Session, ids: Record<string, unknown> = {}) { return AdelanteEHR._recordAudit({ category: 'clinical', action, actorRole: signupActor.role, patientId: s.patientId, detail: { sessionId: s.id, ...ids, simulated: true } }); }
function result(s: Session, outcome: SignupOutcome, action: string, extra: Omit<Partial<SignupResult>, 'event'> = {}, ids: Record<string, unknown> = {}): SignupResult { return { sessionId: s.id, outcome, ...extra, event: event(action,s,ids) }; }
function duplicate(d: Draft) { return duplicateDecision(d, AdelanteEHR.listPatients().map(p => ({ ...p, hasAccount: Boolean(p.signupCredential), merged: Boolean(p.mergedInto) }))); }
const openReferrals = () => AdelanteEHR.listReferrals().filter(r => ['submitted','contacted'].includes(r.status)).map(r => ({...r,dob:r.dob ?? ''}));
/** 26 Oct (Mitch): every signup review case becomes an Identity review queue item — never a coordinator case task. */
function review(s: Session, type: IdentityReviewType, opts: { patientId?: string; referralId?: string; candidatePatientIds?: string[]; candidateReferralIds?: string[]; source?: IdentityReviewSource } = {}) { const d = s.draft; const item = createIdentityReviewItem({ type, source: opts.source ?? 'sign-up', sessionId: s.id, patientId: opts.patientId, referralId: opts.referralId, candidatePatientIds: opts.candidatePatientIds, candidateReferralIds: opts.candidateReferralIds, entries: { firstName: d?.firstName ?? '', lastName: d?.lastName ?? '', dob: d?.dob ?? '', phone: d?.phone, email: d?.email, referralSource: d?.source } }); event('referral_review_task_created',s,{itemId:item.id}); return item.id; }
function verifiedDraft(s: Session): Draft | undefined { const d = s.draft; if (!d || !s.verified) return undefined; const c = s.verified.contact; return { ...d, phone: c.includes('@') ? d.phone : c, email: c.includes('@') ? c : d.email }; }
/** Creates a NEW account. Requires a verified contact — never on unverified entries. */
function create(s: Session, reviews: { type: IdentityReviewType; referralId?: string; candidateReferralIds?: string[]; source?: IdentityReviewSource }[] = []) {
 const d = verifiedDraft(s); if (!d) return result(s,'verify_required','signup_contact_unverified');
 const dup = duplicate(d); if (dup.blocked) return result(s,'blocked','duplicate_account_blocked');
 if (s.patientId) return result(s,'new','signup_completed',{patientId:s.patientId});
 const p = AdelanteEHR.createPatient({ ...d, signupCredential: credentialMeta(d.credentialKind), matchSource: 'website_signup' }); s.patientId = p.id;
 if (dup.possible || p.possibleDuplicate) { const candidatePatientIds = AdelanteEHR.listPatients().filter(x => x.id !== p.id && !x.mergedInto && sameIdentity(d, x)).map(x => x.id); review(s,'possible_duplicate_account',{patientId:p.id,candidatePatientIds}); }
 for (const r of reviews) review(s, r.type, { patientId: p.id, referralId: r.referralId, candidateReferralIds: r.candidateReferralIds, source: r.source });
 return result(s,'new','signup_completed',{patientId:p.id});
}
function linkReferral(s: Session, r: Referral, how: string) {
 const pid = AdelanteEHR.enrollReferral(r.id,{websiteSignup:true}); const p = pid ? AdelanteEHR.getPatient(pid) : undefined; if (!p) throw new Error('Could not connect the plan.');
 p.signupCredential = credentialMeta(s.draft?.credentialKind ?? 'passwordless'); if (s.draft?.preferredLanguage) p.preferredLanguage = s.draft.preferredLanguage; s.patientId = p.id;
 event('referral_linked',s,{referralId:r.id,recordId:p.id,reasonCode:how}); return result(s,'matched','signup_completed',{patientId:p.id});
}
function claimCode(s: Session, raw: string, now: number) { const d = s.draft; if (!d) throw new Error('Missing signup draft.'); const key = `${nameKey(d.firstName)}:${nameKey(d.lastName)}:${d.dob}`; const times = deviceAttempts.get(key) ?? []; if (!attemptsAllowed(times,now)) { const itemId = review(s,'code_lockout',{source:'code attempts'}); return result(s,'mismatch','referral_code_attempted',{limited:true},{reasonCode:'rate_limited',itemId}); } times.push(now); deviceAttempts.set(key,times); const code = normalizeEnrollmentCode(raw); const idMatch = (b: SignupIdentity) => d.firstName ? codeIdentityMatches(d,b) : paperCodeMatches(d,b); const rec = code ? AdelanteEHR.getEnrollmentCode(code) : undefined; if (!rec && code) { const rc = referralClaimCodeFor(code); if (rc) { const r = AdelanteEHR.listReferrals().find(x => x.id === rc.referralId); const reasonCode = rc.consumedAt ? 'used' : +new Date(rc.expiresAt) <= now ? 'expired' : !r || !['submitted','contacted'].includes(r.status) ? 'record_missing' : !idMatch({...r,dob:r.dob ?? ''}) ? 'identity_mismatch' : undefined; if (reasonCode || !r) return result(s,'mismatch','referral_code_attempted',{},{reasonCode:reasonCode ?? 'unknown'}); event('referral_code_attempted',s,{referralId:r.id,reasonCode:'matched'}); consumeReferralClaimCode(rc); return linkReferral(s,r,'paper_code'); } } const p = rec ? AdelanteEHR.getPatient(rec.patientId) : undefined; const status = code ? AdelanteEHR.enrollmentCodeStatus(code,new Date(now)) : 'malformed'; const reasonCode = status !== 'valid' ? status : !p ? 'record_missing' : !idMatch(p) ? 'identity_mismatch' : p.signupCredential ? 'used' : undefined; if (reasonCode || !p || !code) return result(s,'mismatch','referral_code_attempted',{}, {reasonCode:reasonCode ?? 'unknown'}); event('referral_code_attempted',s,{recordId:p.id,reasonCode:'matched'}); const claimed = AdelanteEHR.redeemEnrollmentCode({code,credential:credentialMeta(d.credentialKind),at:new Date(now)}).patient; s.patientId = claimed.id; claimed.preferredLanguage=d.preferredLanguage; event('referral_linked',s,{recordId:claimed.id}); return result(s,'matched','signup_completed',{patientId:claimed.id}); }
function sendCode(s: Session, channel: 'sms'|'email', now: number) {
 const d = s.draft; const contact = channel === 'sms' ? phoneKey(d?.phone) : emailKey(d?.email);
 if (!contact || (channel === 'email' && !contact.includes('@'))) return result(s,'step','contact_code_refused',{},{reasonCode:'no_contact'});
 if (s.otp && !s.otp.used && s.otp.contact === contact && now - s.otp.at < OTP_RESEND_MS) return result(s,'verify','contact_code_sent',{demoCode:s.otp.code,resendAt:s.otp.at+OTP_RESEND_MS,contactMask:maskContact(contact)},{channel,reasonCode:'throttled'});
 s.otp = { code: String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6,'0'), contact, channel, at: now, tries: 0, used: false };
 return result(s,'verify','contact_code_sent',{demoCode:s.otp.code,resendAt:now+OTP_RESEND_MS,contactMask:maskContact(contact)},{channel});
}
function verifyCode(s: Session, otp: string, now: number) {
 const o = s.otp; const valid = o && !o.used && otpAllowed(o.at,o.tries,now); if (o) o.tries++;
 if (!valid || o?.code !== otp) return result(s,'verify','contact_code_verified',{demoCode:o?.code,resendAt:o ? o.at+OTP_RESEND_MS : undefined,contactMask:o ? maskContact(o.contact) : undefined},{reasonCode:'not_verified'});
 o.used = true; s.verified = { contact: o.contact, how: 'code' }; event('contact_code_verified',s,{channel:o.channel,reasonCode:'verified'});
 // Paper-code path: the person already matched; this verifies their new contact once.
 if (s.patientId) { const p = AdelanteEHR.getPatient(s.patientId); if (p) { if (o.channel === 'sms') p.phone = o.contact; else p.email = o.contact; AdelanteEHR._emit(); } return result(s,'matched','signup_contact_added',{patientId:s.patientId}); }
 const d = verifiedDraft(s)!; if (duplicate(d).blocked) return result(s,'blocked','duplicate_account_blocked');
 const open = openReferrals();
 const exact = verifiedContactReferralMatches(d, open);
 if (exact.length === 1) return linkReferral(s, AdelanteEHR.listReferrals().find(r => r.id === exact[0].id)!, 'verified_contact');
 const sameNameDob = open.filter(r => r.identityConfidence !== 'public_unverified' && nameKey(r.lastName) === nameKey(d.lastName) && r.dob && r.dob === d.dob);
 if (sameNameDob.length) return create(s,[{ type: 'contact_differs_from_referral', referralId: sameNameDob[0].id, candidateReferralIds: sameNameDob.map(r => r.id) }]);
 const resembles = publicReferralResembles(d, open);
 if (resembles.length) return create(s,[{ type: 'public_referral_resemblance', referralId: resembles[0].id, candidateReferralIds: resembles.map(x => x.id) }]);
 return create(s);
}
// ---------------------------------------------------------------- invite link
function inviteOpen(s: Session, token: string, now: number) {
 const inv = _inviteByToken(token); const status = inviteStatus(inv, now); const r = inv ? _inviteReferral(inv) : undefined;
 if (!inv || status !== 'valid' || !r || !['submitted','contacted'].includes(r.status)) return result(s,'invite_expired','signup_invite_opened',{},{inviteId:inv?.id,reasonCode:status === 'valid' ? 'record_closed' : status});
 s.invite = { id: inv.id, tries: inv.identityTries };
 return result(s,'invite_identity','signup_invite_opened',{},{inviteId:inv.id,reasonCode:'valid'});
}
function inviteIdentity(s: Session, lastName: string, dob: string, now: number) {
 const inv = s.invite ? _inviteById(s.invite.id) : undefined; const r = inv ? _inviteReferral(inv) : undefined;
 if (!inv || inviteStatus(inv, now) !== 'valid' || !r) return result(s,'invite_expired','signup_invite_identity',{},{inviteId:inv?.id,reasonCode:'expired'});
 if (inv.identityTries >= INVITE_IDENTITY_TRY_LIMIT) { review(s,'code_lockout',{source:'invite link',referralId:r.id}); return result(s,'invite_mismatch','signup_invite_identity',{limited:true},{inviteId:inv.id,reasonCode:'rate_limited'}); }
 inv.identityTries++;
 const ok = nameKey(lastName) && nameKey(lastName) === nameKey(r.lastName) && !!dob && dob === r.dob;
 if (!ok) { const limited = inv.identityTries >= INVITE_IDENTITY_TRY_LIMIT; if (limited) { s.draft = { ...(s.draft ?? blankDraft()), lastName, dob }; review(s,'code_lockout',{source:'invite link',referralId:r.id}); } return result(s,'invite_mismatch','signup_invite_identity',limited ? {limited:true} : {},{inviteId:inv.id,reasonCode:'identity_mismatch'}); }
 const c = contactOnFile(r)!; _consumeInvite(inv, now); s.verified = { contact: c.key, how: 'invite' };
 s.draft = { ...(s.draft ?? blankDraft()), firstName: r.firstName, lastName: r.lastName, dob: r.dob ?? dob, phone: c.channel === 'sms' ? c.key : undefined, email: c.channel === 'email' ? c.key : undefined };
 event('signup_invite_identity',s,{inviteId:inv.id,referralId:r.id,reasonCode:'matched'});
 return linkReferral(s, r, 'invite_link');
}
function inviteContinue(s: Session, input: SignupCommand, now: number) {
 const inv = s.invite ? _inviteById(s.invite.id) : undefined; const r = inv ? _inviteReferral(inv) : undefined;
 if (!inv || !r) return result(s,'invite_expired','signup_invite_continue',{},{reasonCode:'expired'});
 if (!input.firstName?.trim() || !input.lastName?.trim() || !input.dob) return result(s,'invite_mismatch','signup_invite_continue',{},{inviteId:inv.id,reasonCode:'missing'});
 // Possession of the contact on file is proven by the tap; the identity did not match, so nothing links.
 const c = contactOnFile(r)!; _consumeInvite(inv, now); s.verified = { contact: c.key, how: 'invite' };
 s.draft = { ...(s.draft ?? blankDraft()), firstName: input.firstName.trim(), lastName: input.lastName.trim(), dob: input.dob };
 return create(s,[{ type: 'invite_identity_mismatch', referralId: r.id, source: 'invite link' }]);
}
function blankDraft(): Draft { return { firstName: '', lastName: '', dob: '', preferredLanguage: 'en', credentialKind: 'passwordless' }; }
/** All public writes enter through website_signup in runAction; this is not hosted authentication. */
export function runSignupCommand(actor: ChartActor, input: SignupCommand, now = Date.now()): SignupResult {
 if (!canUseSignup(actor)) throw new Error('Public signup only.');
 if (input.operation === 'start') { const s: Session = {id:crypto.randomUUID(),times:[]}; sessions.set(s.id,s); return result(s,'started','signup_started'); }
 const s = input.sessionId ? sessions.get(input.sessionId) : undefined; if (!s) throw new Error('Restart signup.');
 if (input.operation === 'step') return result(s,'step','signup_step_completed',{}, {stepId:input.stepId});
 if (input.operation === 'invite_open') return inviteOpen(s, input.token ?? '', now);
 if (input.operation === 'invite_identity') return inviteIdentity(s, input.lastName ?? '', input.dob ?? '', now);
 if (input.operation === 'invite_continue') return inviteContinue(s, input, now);
 if (input.operation === 'invite_resend') { const out = _resendFromToken(input.token ?? '', now); return result(s,'invite_resent','signup_invite_resent',out.sent ? {contactMask:out.contactMask,demoLink:out.demoLink} : {},{inviteId:out.sent ? out.inviteId : undefined,reasonCode:out.sent ? 'sent' : 'not_sent'}); }
 if (input.operation === 'invite_lost') { const inv = _inviteByToken(input.token ?? ''); if (inv) review(s,'invite_contact_lost',{referralId:inv.referralId,source:'invite link'}); return result(s,'invite_lost','signup_invite_contact_lost',{},{inviteId:inv?.id}); }
 if (input.operation === 'set_signin') { if (!s.patientId) throw new Error('Finish setup first.'); const p = AdelanteEHR.getPatient(s.patientId); const kind = input.credentialKind ?? 'passwordless'; if (p) { p.signupCredential = credentialMeta(kind); AdelanteEHR._emit(); } return result(s,'signin_set','signup_signin_set',{patientId:s.patientId},{credentialKind:kind,remember:!!input.remember}); }
 if (input.operation === 'referral_source') { s.draft = { ...(s.draft ?? blankDraft()), source: input.source }; return result(s,'saved','signup_source_answered',{patientId:s.patientId}); }
 if (input.draft) s.draft = {...input.draft,firstName:input.draft.firstName.trim(),lastName:input.draft.lastName.trim(),phone:phoneKey(input.draft.phone),email:emailKey(input.draft.email)};
 if (input.operation === 'save') { if (s.draft) s.draft = {...s.draft,credentialKind:'password'}; return result(s,'saved','signup_draft_saved'); }
 if (!s.draft) throw new Error('Missing signup draft.');
 if (input.operation === 'retry' || (input.operation === 'finish' && input.path === 'code')) return claimCode(s,input.code ?? '',now);
 if (input.operation === 'send_code' || input.operation === 'resend') return sendCode(s, input.channel ?? s.otp?.channel ?? (s.draft.phone ? 'sms' : 'email'), now);
 if (input.operation === 'verify_code' || input.operation === 'verify') return verifyCode(s, input.otp ?? '', now);
 if (!s.patientId && duplicate(s.draft).blocked) return result(s,'blocked','duplicate_account_blocked');
 // 'continue' / 'finish' new: only after a verified contact.
 return create(s);
}
export function resumeSignupDraft(id: string) { const d = sessions.get(id)?.draft; return d ? {firstName:d.firstName,lastName:d.lastName,dob:d.dob,phone:d.phone,email:d.email} : undefined; }

/** Phase A safety linkage accessor: IDs only, no draft/contact/verification data. */
export function signupSafetyLink(sessionId: string): { exists: boolean; patientId?: string } { const s = sessions.get(sessionId); return { exists: !!s, patientId: s?.patientId }; }
/** 26 Oct evening (Mitch): free-text sign-up answers for the safety scan only; never audited or shown. */
export function signupFreeText(sessionId: string): { field: string; text: string }[] { const d = sessions.get(sessionId)?.draft; if (!d) return []; const out: { field: string; text: string }[] = []; for (const [field, text] of [['source', d.source], ['helperName', d.helperName]] as [string, string | undefined][]) if (text?.trim()) out.push({ field, text }); return out; }

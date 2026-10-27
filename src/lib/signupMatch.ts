/** Pure public identity rules. No store reads or mutations. */
export type SignupIdentity = { firstName: string; lastName: string; dob: string; phone?: string; email?: string };
export const CODE_ATTEMPT_LIMIT = 5;
export const CODE_WINDOW_MS = 15 * 60 * 1000;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_TRY_LIMIT = 5;
export const OTP_RESEND_MS = 30 * 1000;
export const nameKey = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\s'’\-]/g, '').trim();
export function phoneKey(value = '') { const d = value.replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length >= 11 && d.length <= 15 ? `+${d}` : ''; }
export const emailKey = (value = '') => value.trim().toLowerCase();
export function sameIdentity(a: SignupIdentity, b: SignupIdentity) { return Boolean(a.dob && b.dob && a.dob === b.dob && nameKey(a.firstName) === nameKey(b.firstName) && nameKey(a.lastName) === nameKey(b.lastName)); }
export function sameContact(a: Pick<SignupIdentity, 'phone'|'email'>, b: Pick<SignupIdentity, 'phone'|'email'>) { return Boolean((phoneKey(a.phone) && phoneKey(a.phone) === phoneKey(b.phone)) || (emailKey(a.email) && emailKey(a.email) === emailKey(b.email))); }
export function codeIdentityMatches(a: SignupIdentity, b: SignupIdentity) { const first = nameKey(a.firstName), other = nameKey(b.firstName); return Boolean(a.dob && a.dob === b.dob && nameKey(a.lastName) === nameKey(b.lastName) && first && other && (first === other || first[0] === other[0])); }
// 26 Oct (Mitch): auto-match only considers open verified-source referrals. A
// public_unverified referral (family/friend/self) NEVER auto-matches and never
// triggers a one-time code, even when name, DOB and contact all match.
export function referralMatches(a: SignupIdentity, referrals: (SignupIdentity & { id: string; status: string; identityConfidence?: string })[]) { return referrals.filter(r => ['submitted','contacted'].includes(r.status) && r.identityConfidence !== 'public_unverified' && sameIdentity(a,r) && sameContact(a,r)); }
/** A sign-up resembles a public referral: same normalized last name plus any of DOB, phone or email. Drives an Identity review item, never an auto-match. */
export function publicReferralResembles(a: SignupIdentity, referrals: (SignupIdentity & { id: string; status: string; identityConfidence?: string })[]) { return referrals.filter(r => ['submitted','contacted'].includes(r.status) && r.identityConfidence === 'public_unverified' && nameKey(a.lastName) && nameKey(a.lastName) === nameKey(r.lastName) && ((a.dob && r.dob && a.dob === r.dob) || sameContact(a, r))); }
export function duplicateDecision(a: SignupIdentity, patients: (SignupIdentity & { id: string; hasAccount: boolean; merged?: boolean })[]) { const matches = patients.filter(p => !p.merged && sameIdentity(a,p)); return { blocked: matches.some(p => p.hasAccount && sameContact(a,p)), possible: matches.some(p => !sameContact(a,p)) }; }
export function validAge(dob: string, now = new Date()) { const d = new Date(`${dob}T12:00:00Z`); if (!dob || Number.isNaN(+d) || +d >= +now || d.toISOString().slice(0,10) !== dob) return false; let age = now.getUTCFullYear() - d.getUTCFullYear(); if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age--; return age >= 12 && age <= 110; }
export function attemptsAllowed(times: number[], now: number) { return times.filter(t => now >= t && now - t < CODE_WINDOW_MS).length < CODE_ATTEMPT_LIMIT; }
export function otpAllowed(issuedAt: number, attempts: number, now: number) { return now >= issuedAt && now - issuedAt < OTP_TTL_MS && attempts < OTP_TRY_LIMIT; }
/** 27 Oct (Mitch): paper RE-code path — code + last name + DOB. */
export function paperCodeMatches(a: Pick<SignupIdentity,'lastName'|'dob'>, b: Pick<SignupIdentity,'lastName'|'dob'>) { return Boolean(a.dob && a.dob === b.dob && nameKey(a.lastName) && nameKey(a.lastName) === nameKey(b.lastName)); }
/** 27 Oct (Mitch): not-invited path — a VERIFIED contact + last name + DOB matching an open verified-source referral's contact on file links it. Public referrals never auto-match. */
export function verifiedContactReferralMatches(a: SignupIdentity, referrals: (SignupIdentity & { id: string; status: string; identityConfidence?: string })[]) { return referrals.filter(r => ['submitted','contacted'].includes(r.status) && r.identityConfidence !== 'public_unverified' && paperCodeMatches(a,r) && sameContact(a,r)); }

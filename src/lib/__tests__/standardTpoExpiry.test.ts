import { it, expect } from "vitest";
import { STANDARD_TPO_EXPIRY_VECTORS, standardTpoExpiryError } from "../standardTpoExpiry";
for (const v of STANDARD_TPO_EXPIRY_VECTORS)
  it(`standard TPO expiry vector: ${v.code}`, () => {
    expect(standardTpoExpiryError({ consentType: "part2_tpo_single", expiresOn: v.expiresOn, expiresOnEvent: v.expiresOnEvent })).toBe(v.expected);
  });
it("other consent types keep their own end rules", () => {
  expect(standardTpoExpiryError({ consentType: "hipaa_authorization", expiresOn: "2027-10-27" })).toBeNull();
});

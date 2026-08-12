// Installs the real SMS transport into the staff-alert dispatcher. Called once
// from the root route (browser only) so tests and SSR keep the inert default.
import { markStaffAlertDelivery, setStaffAlertTransport } from "./staffAlerts";
import { sendStaffAlertSms } from "./staffAlerts.functions";

export function installSmsStaffAlertTransport(): void {
  setStaffAlertTransport(async (record) => {
    const res = await sendStaffAlertSms({
      data: { kind: record.kind, subject: record.subject, body: record.body },
    });
    markStaffAlertDelivery(record.id, res.status, res.detail);
  });
}

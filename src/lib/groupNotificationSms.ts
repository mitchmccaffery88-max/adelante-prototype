// Installs the real SMS transport for patient group notifications (browser only).
import { markGroupNotificationDelivery, setGroupNotificationTransport } from "./groupNotifications";
import { sendGroupNotificationSms } from "./groupNotify.functions";

export function installGroupNotificationSmsTransport(): void {
  setGroupNotificationTransport(async (record) => {
    if (!record.to) return;
    const res = await sendGroupNotificationSms({ data: { to: record.to, body: record.body } });
    markGroupNotificationDelivery(record.id, res.status, res.detail);
  });
}

import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useActingStaff } from "@/lib/roles";
import { canViewAccountSupport, listAccountSupportItems } from "@/lib/accountSupport";
export const Route = createFileRoute("/admin-account-support")({
  head: () => ({meta: [{title: "Account support — Adelante"}, {name: "description", content: "Staff account support for sign-in help, resets and lockouts."}, {property: "og:title", content: "Account support — Adelante"}, {property: "og:description", content: "Account assistance, separate from identity decisions."}, {property: "og:type", content: "website"}, {name: "twitter:card", content: "summary"}]}),
  component: AccountSupport,
});
function AccountSupport() {
  const actor = useActingStaff();
  if (!canViewAccountSupport(actor.role)) return <p className="p-6 flex gap-2"><Lock />Account support permission required.</p>;
  const items = listAccountSupportItems();
  return <main className="mx-auto max-w-5xl p-6 space-y-4"><h1 className="text-2xl font-bold">Account support</h1><p className="text-sm text-ink-muted">Simulated — sign-in help and reset delivery are not connected.</p>{!items.length && <p>Nothing waiting for account support.</p>}</main>;
}
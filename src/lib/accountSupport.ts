import { canAccess, type StaffRole } from "./roles";
/** Separate grant: intake and identity review never imply account support. */
export const canViewAccountSupport = (role: StaffRole) => canAccess(role, "account_support").level !== "none";
export const listAccountSupportItems = (): { id: string; status: "yourturn" | "withothers" | "closed"; createdAt: string; type: string; assignee?: string }[] => [];
export const accountSupportYourTurnCount = () => listAccountSupportItems().filter(item => item.status === "yourturn").length;
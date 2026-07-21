// Vendor adapter registry. UI code should reach vendors through AdelanteEHR
// helpers whenever possible; direct imports are allowed only for pass-through
// affordances (e.g. eRx SSO launch URL).

import { MockTelehealthAdapter, type TelehealthAdapter } from "./telehealth";
import { MockEscribeAdapter, type ErxAdapter } from "./erx";

export const telehealth: TelehealthAdapter = MockTelehealthAdapter;
export const erx: ErxAdapter = MockEscribeAdapter;

export const vendors = { telehealth, erx };
export type { TelehealthAdapter, ErxAdapter };
export type { TelehealthRoom } from "./telehealth";
export type { Medication, RxEvent, RxEventKind } from "./erx";
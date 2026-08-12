---
name: Peer specialist messaging
description: Peers answer in the ONE care-team thread via authorType staff + authorRole; they write but cannot flag Part 2; architecture doc lives at mem/architecture/message-routing.md
type: feature
---
- There is exactly ONE patient message thread per patient (`CareMessage`, `threadPatientId`). Peer specialists answer inside it — no peer-only channel. Splitting it would fragment crisis detection, unread state and `/message-queue`.
- `authorType` stays `"patient" | "staff"`. Staff type is expressed by `authorRole?: StaffRole`, recorded on send and shown to the member ("Andre Willis (Peer specialist)").
- `peer_specialist` has `write` on `patient_messaging`, but is deliberately NOT in `MESSAGE_SUD_FLAG_ROLES` (therapist/pmhnp/ecm_provider): flagging HIDES content, and a role that is itself consent-gated for SUD must not be able to mask it from treating roles.
- Andre Willis (`s-peer1`, CPSS) is the real peer identity — never invent another.
- Crisis language in this channel uses the one real mechanism (`scanTextForCrisis` → `flagCrisis`, `message_pattern`) after commit; the message is still delivered verbatim.
- Full audited map of every free-text surface, crisis wiring and known gaps: `mem/architecture/message-routing.md`.

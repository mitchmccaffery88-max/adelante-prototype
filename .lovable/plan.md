Only one Healthie reference remains in the codebase (a full search found nothing else):

- `README.md` line 52: "In production, PHI lives only in Healthie and the AWS perimeter."

## Change

Rewrite that sentence to reflect the native Adelante EHR posture with bounded outside vendors:

> In production, PHI lives only in the native Adelante EHR and its AWS perimeter. Bounded outside vendors (telehealth video, eRx) receive the minimum data required for their service.

No other files need edits — prior renames already moved all code paths off Healthie.

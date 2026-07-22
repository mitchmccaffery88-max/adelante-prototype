# Adelante MVP — Lovable Prototype

This repo contains a UX prototype built in Lovable (adelmvp1.lovable.app).
It is NOT production code. Do not build on top of this directly.

## What's here
- /src/pages — all route views (patient, referral, clinician, case manager, admin)
- /src/components — UI components per module
- Stack: React + TypeScript + TanStack (Lovable template)

## Purpose
Functional spec and UX reference for the production build.
The production stack is Next.js / Node / TypeScript / PostgreSQL / AWS.

## Live prototype
https://adelmvp1.lovable.app

## Do not
- Merge into production main branch
- Use Lovable's auth, data persistence, or backend stubs
- Treat any mocked data as real patient data

## Notes for Engineer — Audit Session

### Stack delta
This prototype uses Vite + Bun + TanStack Router (Lovable default).
Production stack is Next.js / Node / TypeScript / PostgreSQL / AWS.
Do not port the router config. Reconstruct routes in Next.js using 
these files as visual/logic reference only.

### Component architecture
Most module logic lives directly in route files, not in /components.
/components has 5 shared components (AppShell, Landing, PatientHome, 
ClientDate, ReadAloudButton). The /components/ui folder is shadcn/ui 
primitives — these ARE portable to the production build.

### Route inventory
| Route file       | URL             | Persona              | MVP scope |
|------------------|-----------------|----------------------|-----------|
| index.tsx        | /               | Public landing       | Yes       |
| home.tsx         | /home           | Patient              | Yes       |
| intake.tsx       | /intake         | Patient              | Yes       |
| referral.tsx     | /referral       | Probation/partner    | Yes       |
| clinician.tsx    | /clinician      | Clinician            | Yes       |
| case-manager.tsx | /case-manager   | Case manager         | Yes       |
| admin.tsx        | /admin          | Admin                | Yes       |
| patient.tsx      | /patient        | Patient (alt view?)  | Clarify   |
| schedule.tsx     | /schedule       | Unknown              | Clarify   |

### PHI boundary
No real PHI exists in this repo. All patient data is mocked.
In production, PHI lives only in Healthie and the AWS perimeter.
Cognito handles auth with 42 CFR Part 2 role segmentation.

### Mocked integrations
- Twilio SMS: referenced in admin view, not wired
- Billing/EDI: status display only, no clearinghouse connection

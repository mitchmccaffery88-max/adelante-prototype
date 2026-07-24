# Native EHR adapter layer

Thin seam between UI/feature code and the storage backend for **patient**,
**appointment**, and **clinician** data.

## Using it

```ts
import { getEhrAdapter } from "@/lib/ehr/index";

const ehr = getEhrAdapter();
const patients = ehr.listPatients();
```

`@/lib/ehr/index` registers the default in-memory adapter as an import side
effect. Import it once at app boot (or from any consumer) before calling
`getEhrAdapter()`.

## Swapping the backend

1. Implement `EhrAdapter` from `./adapter` against your backend
   (Supabase, REST, gRPC, etc.). See `./adapters/native-memory.ts` for the
   reference wrapper.
2. In `src/start.ts` (or another boot entry) call:

   ```ts
   import { registerEhrAdapter } from "@/lib/ehr";
   import { myBackendAdapter } from "@/lib/ehr/adapters/my-backend";
   registerEhrAdapter(myBackendAdapter);
   ```

3. No call site changes — the interface stays the same.

## Scope

Only the read/write operations the app uses today for the three domains
are in the port. Extended domains (credentials, claims, coverage) still
live on `AdelanteEHR` / `AdelanteEHRExt` and can be added later.
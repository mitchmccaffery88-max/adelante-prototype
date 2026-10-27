import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { FoundationContext, FoundationRecord, PersistenceDomain, FoundationRepository } from './foundation';
const TABLES: Record<PersistenceDomain, string> = { accounts:'accounts', staff_roles:'staff_role_assignments', feature_flags:'feature_flags', audit:'audit_events', consent:'consent_records', patients_core:'patients' };
const PROJECTIONS: Record<PersistenceDomain, string> = {
 accounts:'id,org_id,kind,active,synthetic',
 staff_roles:'id,org_id,staff_id,role,is_primary,active',
 feature_flags:'id,org_id,flag_key,enabled,simulated,mode',
 audit:'id,org_id,actor_account_id,acting_role,action_code,entity_id,patient_id,outcome_code,simulated,registry_version,created_at',
 consent:'id,org_id,patient_id,consent_type,purpose_code,status,effective_at,expires_at,signed_by_kind',
 patients_core:'id,org_id,account_id,synthetic',
};
export const foundationContext = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context}) => {
 const {data,error} = await context.supabase.rpc('foundation_current_context');
 if(error) throw new Error('Beta access is unavailable.');
 return data as unknown as FoundationContext;
});
export const foundationRead = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{domain:PersistenceDomain}) => {
 if(!Object.hasOwn(TABLES,input.domain)) throw new Error('Unknown foundation domain.'); return input;
}).handler(async({context,data}) => {
 const table=TABLES[data.domain];
 const {data:verified,error:contextError}=await context.supabase.rpc('foundation_current_context');
 const identity=verified as unknown as FoundationContext|null;
 if(contextError||!identity?.attested||!identity.org_id) throw new Error('Accept the fictional-data agreement first.');
 // All reads remain caller-RLS scoped. Broad clinical reads are deliberately absent.
 const {data:rows,error} = await context.supabase.from(table as 'accounts').select(PROJECTIONS[data.domain]).eq('org_id',identity.org_id);
 if(error) throw new Error('This Beta information is unavailable.');
 return rows as unknown as FoundationRecord[];
});
export const foundationCommand = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{command:'attest'|'set_role';value:string}) => {
 if(!['attest','set_role'].includes(input.command) || typeof input.value!=='string' || input.value.length>64) throw new Error('Invalid Beta action.');
 if(input.command==='attest'&&!['en','es'].includes(input.value)) throw new Error('Choose a language.'); return input;
}).handler(async({context,data}) => {
 const {data:verified,error} = await context.supabase.rpc('foundation_current_context');
 const identity=verified as unknown as FoundationContext|null;
 if(error || !identity?.account_id) throw new Error('Your Beta account is not provisioned.');
 if(data.command==='set_role'&&!identity.attested) throw new Error('Accept the fictional-data agreement first.');
 if(data.command==='set_role'&&identity.kind!=='staff') throw new Error('Staff role required.');
 // Trusted caller was authenticated above; SQL validates the held role itself.
 const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
 const {data:result,error:writeError} = await supabaseAdmin.rpc('foundation_command',{p_user:context.userId,p_command:data.command,p_value:data.value});
 if(writeError) throw new Error('This Beta action could not be completed.');
 return result;
});
export const supabaseFoundationRepository: FoundationRepository = {
 context:()=>foundationContext(),
 list:domain=>foundationRead({data:{domain}}),
 command:(command,value)=>foundationCommand({data:{command,value}}),
};
import { websiteEn, websiteEs } from '../i18n.website';
export type Intent = 'crisis' | 'get_care' | 'signup' | 'help_someone' | 'referral' | 'sud_groups' | 'coverage_medical' | 'coverage_other' | 'reentry' | 'careers' | 'resources_need' | 'language' | 'contact' | 'privacy' | 'signin_help' | 'no_match';
type Key = keyof typeof websiteEn;
export type PublicAction = { label: Key; to?: string; query?: Record<string,string>; toggle?: boolean };
export const starters: { intent: Intent; label: Key }[] = [
 {intent:'get_care',label:'website.v2.ask.starter.care'}, {intent:'help_someone',label:'website.v2.ask.starter.help'}, {intent:'referral',label:'website.v2.ask.starter.referral'}, {intent:'coverage_medical',label:'website.v2.ask.starter.medical'}, {intent:'resources_need',label:'website.v2.ask.starter.resources'}, {intent:'sud_groups',label:'website.v2.ask.starter.groups'}
];
export const crisisPhrases = ['suicide','suicidal','kill myself','end my life','want to die','hurt myself','self-harm','overdose','overdosing',"can't go on",'no reason to live','going to hurt someone','suicidio','suicidarme','matarme','quitarme la vida','quiero morir','hacerme daño','sobredosis','no puedo más','lastimar a alguien'];
export const intentKeywords: [Intent,string[]][] = [
 ['get_care',['need help','get care','therapy','counselor','talk to someone','mental health','ayuda','terapia','consejero','salud mental']],
 ['signup',['sign up','register','create account','registrarme','crear cuenta']],
 ['help_someone',['help someone','my son','my daughter','my brother','my sister','family member','loved one','my friend','advocate','ayudar a alguien','mi hijo','mi hija','familiar','ser querido']],
 ['referral',['referral','refer','probation officer','case manager','agency','referencia','referir','agencia']],
 ['sud_groups',['group','groups','recovery','sobriety','aa','na','meeting','meetings','substance','drinking','drugs','grupo','recuperacion','reunion','alcohol','drogas']],
 ['coverage_medical',['medi-cal','medi cal','medicaid']],
 ['coverage_other',['insurance','self pay','self-pay','cost','price','how much','seguro','costo','cuanto cuesta','pagar']],
 ['reentry',['released','got out','jail','prison','parole','reentry','re-entry','incarcerated','sali','carcel','prision','libertad condicional']],
 ['careers',['job at adelante','careers','work for you','work with you','hiring','trabajar con ustedes','empleo con ustedes']],
 ['resources_need',['food','housing','shelter','place to sleep','phone','job','ride','transportation','benefits','comida','vivienda','refugio','telefono','trabajo','transporte','beneficios']],
 ['language',['spanish','espanol','english','ingles','idioma']],
 ['contact',['hours','address','location','phone number','call you','email','horario','direccion','ubicacion']],
 ['privacy',['private','privacy','confidential','who can see','probation know','privado','confidencial']],
 ['signin_help',['sign in','log in','login','password','pin','iniciar sesion','contrasena']]
];
export function normalizeInput(value:string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'"); }
function matches(text:string,phrase:string) { const escaped=normalizeInput(phrase).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text); }
const a=(label:Key,to?:string,query?:Record<string,string>):PublicAction=>({label,to,query});
const actions: Partial<Record<Intent,PublicAction[]>> = {
 crisis:[a('website.v2.ask.call988','tel:988'),a('website.v2.ask.text988','sms:988'),a('website.v2.ask.call911','tel:911')],
 get_care:[a('websiteStart','/start/signup'),a('website.v2.how','/how-it-works')], signup:[a('websiteStart','/start/signup')],
 help_someone:[a('websiteHelp','/referral',{type:'advocate'}),a('website.v2.ask.advocates','/care/advocates')],
 referral:[a('websiteReferral','/referral'),a('website.v2.partners','/partners')],
 sud_groups:[a('website.v2.recovery','/care/recovery'),a('website.v2.ask.meetings','/directory',{category:'recovery'})],
 coverage_medical:[a('website.v2.cost','/cost')],coverage_other:[a('website.v2.cost','/cost'),a('website.v2.contact','/contact')],
 reentry:[a('website.v2.ask.coming','/care/coming-home'),a('websiteStart','/start/signup')],careers:[a('website.v2.careers','/careers')],
 language:[{label:'website.v2.ask.toggle',toggle:true}],contact:[a('website.v2.contact','/contact')],privacy:[a('website.v2.privacy','/privacy')],
 signin_help:[a('website.v2.signin','/auth'),a('website.v2.ask.authhelp','/auth',{help:'1'})],no_match:[a('website.v2.contact','/contact')]
};
export function answerPublicQuestion(input:string,lang:'en'|'es',starter?:Intent) {
 const text=normalizeInput(input); const d=lang==='es'?websiteEs:websiteEn;
 const intent:Intent=crisisPhrases.some(p=>matches(text,p))?'crisis':starter ?? intentKeywords.find(([,words])=>words.some(p=>matches(text,p)))?.[0] ?? 'no_match';
 const guarded=intent!=='crisis' && (/\b\d{8,}\b/.test(text) || /\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/.test(text) || ['diagnosed','diagnosis','my meds','prescription','mg','hiv','hepatitis','diagnostico','receta'].some(p=>matches(text,p)));
 const category=[['housing',['housing','shelter','place to sleep','vivienda','refugio']],['food',['food','comida']],['transportation',['ride','transportation','transporte']],['employment',['job','trabajo']],['benefits',['benefits','phone','beneficios','telefono']]].find(([,words])=>(words as string[]).some(p=>matches(text,p)))?.[0] ?? 'housing';
 return {intent,reply:d[`website.v2.ask.${intent}`],guard:guarded?d['website.v2.ask.guard']:undefined,actions:intent==='resources_need'?[a('website.v2.directory','/directory',{category:String(category)})]:actions[intent] ?? [],showStarters:intent==='no_match'};
}
/** No text, identifier, storage, network or audit. Call separately from the pure classifier. */
export const askAdelPublic = { intentCounts: Object.create(null) as Partial<Record<Intent,number>> };
export function countPublicIntent(intent:Intent) { askAdelPublic.intentCounts[intent]=(askAdelPublic.intentCounts[intent] ?? 0)+1; }

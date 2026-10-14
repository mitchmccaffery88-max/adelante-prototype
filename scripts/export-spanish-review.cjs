/** Development-only source audit. Never imports the EHR or reads runtime/patient data. */
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const sources = new Map();
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
for (const f of walk('src').filter(f => /\.tsx?$/.test(f) && !f.includes('__tests__') && !f.endsWith('routeTree.gen.ts'))) {
 const text=fs.readFileSync(f,'utf8'); sources.set(f,ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS));
}
const memberRoutes = new Set(['index','about','team','auth','assisted-signup','referral','home','patient','intake','rescreen.$key','checkin','library','journeys','recovery-journey','toolkit','profile','documents','medications','next-steps','resources','resources.index','resources.saved','resources.$categoryId.$orgId','craving','slip','crisis','naloxone','safety-plan','safety-check','adel','weekly-recap','refusal']);
const audiences=new Map();
function dependency(f,name){ const base=name.startsWith('@/')?'src/'+name.slice(2):name.startsWith('.')?path.normalize(path.join(path.dirname(f),name)):null; return base && [base,base+'.ts',base+'.tsx',base+'/index.tsx'].find(x=>sources.has(x)); }
function reach(f,screen,seen=new Set()) { if(seen.has(f))return;seen.add(f);if(!audiences.has(f))audiences.set(f,new Set());audiences.get(f).add(screen);
 const sf=sources.get(f);if(!sf)return;for(const n of sf.statements)if(ts.isImportDeclaration(n)){const dep=dependency(f,n.moduleSpecifier.text);if(dep&&!/\/ehr(?:\/|\.ts)|\/roles\.ts|\/navSections\.ts|\/chartActions\.ts/.test(dep))reach(dep,screen,seen);}
}
for(const f of sources.keys()){if(!f.startsWith('src/routes/')||f.includes('/api/'))continue;const name=path.basename(f).replace(/\.tsx?$/,'');if(memberRoutes.has(name)||name.startsWith('advocate')||name.startsWith('start.'))reach(f,'/'+name.replace(/\.index$/,'').replace(/\./g,'/'));}
for(const f of ['src/lib/i18n.tsx','src/lib/i18n.website.ts','src/lib/i18n.player.ts','src/lib/i18n.recovery.ts','src/lib/i18n.benefits.ts'])reach(f,f.includes('website')?'Public website':'Shared member UI');
// Shared shell: audit only ordinary translated dictionaries, not staff JSX.
const rows=new Map(),covered=new Set();
const exclusions = JSON.parse(fs.readFileSync('scripts/spanish-review-exclusions.json', 'utf8'));
function controlled(f,k=''){return /consent|cssrs|screeners|safetyPlan|safetyContent|crisisCopy|refusal|riskText|whatWouldHelp|recovery.*authored/i.test(f)|| /privacy|consent|sensitive|history|danger|risk|legal|justiceQ|seekingNote|advocateNote|handoff/i.test(k);}
function add(f,key,en,es='',node){if(!en || !/[A-Za-zÀ-ÿ]/.test(en))return;const fullKey=f+':'+key;const exclusion=exclusions[fullKey];if(exclusion && /staff-only|false positive/i.test(exclusion))return;const screen=[...(audiences.get(f)||['Shared member content'])].sort().join('; ');const priority=/\/crisis\.|\/naloxone\.|\/safety-plan\.|GetHelpNow|CrisisNotice|AdelGuidedIntake|SlipSupportFlow/.test(f)||/988|911|getHelpNow/i.test(key+' '+en);const status=controlled(f,key)||exclusion?.startsWith('Controlled')?'controlled':priority?'draft-priority':'draft'; rows.set(fullKey,{key:fullKey,english:en,spanish:es,screen,status}); if(node)covered.add(f+":"+node.pos);}
function unwrap(n){while(n&&(ts.isAsExpression(n)||ts.isParenthesizedExpression(n)||ts.isSatisfiesExpression?.(n)))n=n.expression;return n;}
function text(n){n=unwrap(n);if(!n)return '';if(ts.isStringLiteralLike(n))return n.text;if(ts.isTemplateExpression(n))return n.head.text+n.templateSpans.map(s=>'{'+s.expression.getText()+'}'+s.literal.text).join('');if(ts.isArrowFunction(n)){let b=n.body;if(ts.isBlock(b)){const r=b.statements.find(ts.isReturnStatement);b=r?.expression;}return text(b);}return '';}
function obj(n){n=unwrap(n);return n&&ts.isObjectLiteralExpression(n)?n:null;}
function props(n){return new Map((obj(n)?.properties||[]).filter(ts.isPropertyAssignment).map(p=>[p.name.text??p.name.getText(),p.initializer]));}
function flatten(n,prefix='',out=new Map()){for(const [k,v] of props(n)){if(obj(v))flatten(v,prefix+k+'.',out);else if(ts.isArrayLiteralExpression(unwrap(v)))unwrap(v).elements.forEach((e,i)=>{const s=text(e);if(s)out.set(prefix+k+'.'+i,{text:s,node:e});});else {const s=text(v);if(s)out.set(prefix+k,{text:s,node:v});}}return out;}
for(const [f,sf] of sources){if(!audiences.has(f))continue;const declarations=new Map();
 function collect(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))declarations.set(n.name.text,n.initializer);ts.forEachChild(n,collect);}collect(sf);
 function pair(en,es,name){const e=flatten(en),s=flatten(es);for(const [k,v] of e)add(f,name+'.'+k,v.text,s.get(k)?.text||'',v.node);}
 for(const [name,n] of declarations){const p=props(n);if(p.has('en')&&p.has('es'))pair(p.get('en'),p.get('es'),name);if(/En$/.test(name))pair(n,declarations.get(name.replace(/En$/,'Es')),name.replace(/En$/,''));}
 function visit(n){const p=props(n);if(p.has('en')&&p.has('es')&&text(p.get('en'))){const sourceKey=ts.isPropertyAssignment(n.parent)&&n.parent.name&&/^ui\./.test(n.parent.name.text)?n.parent.name.text:'pair.'+crypto.createHash('sha1').update(text(p.get('en'))).digest('hex').slice(0,12);add(f,sourceKey,text(p.get('en')),text(p.get('es')),p.get('en'));}
 if(ts.isConditionalExpression(n)&&/\blang\b/.test(n.condition.getText())){const yes=text(n.whenTrue),no=text(n.whenFalse);if(yes&&no&&/['"](?:es|en)['"]/.test(n.condition.getText())){const esFirst=/['"]es['"]/.test(n.condition.getText());add(f,'inline.'+crypto.createHash('sha1').update((esFirst?no:yes)).digest('hex').slice(0,12),esFirst?no:yes,esFirst?yes:no,n);covered.add(f+":"+n.whenTrue.pos);covered.add(f+":"+n.whenFalse.pos);}}
 ts.forEachChild(n,visit);}visit(sf);
 // Genuine JSX text/visible attributes and direct string expressions only, not enums, classes, IDs or test hooks.
 function jsx(n){let value='';if(ts.isJsxText(n))value=n.text.replace(/\s+/g,' ').trim();else if(ts.isJsxAttribute(n)&&['aria-label','title','placeholder','alt'].includes(n.name.text)&&ts.isStringLiteral(n.initializer))value=n.initializer.text;else if(ts.isJsxExpression(n)&&n.expression&&ts.isStringLiteralLike(n.expression))value=n.expression.text;
 if(value&&!covered.has(f+":"+n.pos)&&!/^\s*[·—.:/\d\s]+$/.test(value)&&!/[<>]/.test(value)){let parent=n.parent;let localized=false;while(parent&&!ts.isSourceFile(parent)){if(ts.isConditionalExpression(parent)&&/\blang\b/.test(parent.condition.getText()))localized=true;parent=parent.parent;}if(!localized)add(f,'ui.'+crypto.createHash('sha1').update(value).digest('hex').slice(0,12),value,'',n);}
 ts.forEachChild(n,jsx);}if(f.startsWith('src/components/')&&!/admin\/|clinical\/|billing\/|ops\/|clinician\/|AppShell|Staff/.test(f)||f.startsWith('src/routes/'))jsx(sf);
}
// Authored catalog and controlled sources: inspect AST only; no runtime seed imports.
for (const [f,sf] of sources) {
 if (!audiences.has(f) || !/recovery(?:\.ts|\.[\w]+\.authored\.ts)|library(?:\.ported\.ts|\.[\w]+\.authored\.ts)|screeners\.ts|safetyPlan\.ts|safetyContent\.ts|cssrs\.ts|consentForms\.ts|refusal\.ts/.test(f)) continue;
 const esOverrides = new Map();
 if(f==='src/lib/recovery.ts') {
  const esFile=sources.get('src/lib/i18n.recovery.ts');
  if(esFile){const gather=n=>{if(ts.isPropertyAssignment(n)&&ts.isStringLiteral(n.name)&&ts.isStringLiteralLike(n.initializer)&&n.name.text.startsWith('rec.'))esOverrides.set(n.name.text,n.initializer.text);ts.forEachChild(n,gather);};gather(esFile);}
 }
 const relevant=new Set(['title','name','subtitle','mission','description','problem','checkIn','learnTitle','learnBody','adelReflection','adelQuestion','insight','toolkitLabel','prompt','label','feedback','body','questions','items','warningSigns','supportPeople','todayActions','summary','what','why','recipient','en','es']);
 function catalog(n,record='content') {
  const p=props(n);const id=text(p.get('id'))||text(p.get('key'));
  if(id)record=id;
  if(p.has('en')&&p.has('es')){const en=text(p.get('en'));if(en)add(f,record+'.controlled',en,text(p.get('es')),p.get('en'));return;}
  for(const [key,node] of p) {
   if(key==='es')continue;
   if(relevant.has(key)) {
    const en=text(node);
    if(en) { const override=esOverrides.get(`rec.${record}.${key}`)||'';add(f,record+'.'+key,en,override,node); }
    else if(ts.isCallExpression(unwrap(node))&&unwrap(node).expression.getText()==='ph') {const en=text(unwrap(node).arguments[0]);if(en)add(f,record+'.'+key,en,en+' (Borrador — traducción pendiente)',node);}
    else if(ts.isArrayLiteralExpression(unwrap(node)))unwrap(node).elements.forEach((item,i)=>{const value=text(item);if(value)add(f,record+'.'+key+'.'+i,value,esOverrides.get(`rec.${record}.${key==='warningSigns'?'warn':key==='supportPeople'?'sup':key==='todayActions'?'todo':key}.${i}`)||'',item);else catalog(item,record+'.'+key+'.'+i);});
   }
   if(obj(node))catalog(node,record+'.'+key);
  }
  if(ts.isArrayLiteralExpression(unwrap(n)))unwrap(n).elements.forEach((e,i)=>catalog(e,record+'.'+i));
 }
 for(const statement of sf.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(d.initializer)catalog(d.initializer,d.name.getText());
}

const sorted=[...rows.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
function safe(v){v=String(v);if(/^[\s]*[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
fs.mkdirSync('docs',{recursive:true});fs.writeFileSync('docs/spanish-review.csv',['key,english,spanish,screen,status',...sorted.map(r=>[r.key,r.english,r.spanish,r.screen,r.status].map(safe).join(','))].join('\n')+'\n');
const gaps=sorted.filter(r=>!r.spanish&&r.status!=='controlled'),grouped=new Map();for(const r of gaps){if(!grouped.has(r.screen))grouped.set(r.screen,[]);grouped.get(r.screen).push(r);}
const lines=['# Spanish gaps — Build 5b','',`Generated by \`bun scripts/export-spanish-review.cjs\`. ${gaps.length} ordinary member/public source keys with empty Spanish. Controlled clinical/legal gaps are excluded from drafting and retained in the CSV.`, '', 'Reviewed staff-only keys and already-localized false positives are excluded using the source review manifest. Crisis-adjacent drafts have status draft-priority. Authored lesson/journey gaps remain for phase 7. No patient records or runtime data are read. Dynamic authored content and expression-based labels require editorial review; this is a source inventory, not a certification of complete runtime coverage.',''];
for(const [screen,items] of [...grouped].sort((a,b)=>a[0].localeCompare(b[0])))lines.push(`## ${screen} (${items.length})`,'',...items.map(r=>`- \`${r.key}\` — ${r.english.replace(/\n/g,' / ')}`),'');
fs.writeFileSync('docs/spanish-gaps.md',lines.join('\n'));console.log(JSON.stringify({rows:sorted.length,gaps:gaps.length,controlled:sorted.filter(r=>r.status==='controlled').length}));

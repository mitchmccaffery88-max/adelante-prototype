import asyncio,json
from datetime import datetime,timezone
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path('/tmp/browser/9c2')
HOMES=[('therapist','s-th1','/clinician','today-strip'),('ecm_provider','s-ecm1','/case-manager','caseload-scope-card'),('billing','s-bill1','/billing','billing-kpis'),('sys_admin','s-admin1','/admin','admin-kpis'),('credentialing_coordinator','s-cred1','/quality-compliance','unusual-volume')]
JS='''() => {
 const nodes=[...document.querySelectorAll('[data-testid]')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
 const all={}; for(const e of nodes){ const id=e.dataset.testid; const c=e.cloneNode(true); c.querySelectorAll('[data-testid]').forEach(x=>x.remove()); const text=c.textContent.trim(); (all[id]??=[]).push(text); }
 for(const k of Object.keys(all)) all[k].sort();
 const tiles=[...document.querySelectorAll('[data-stat-tile]')].map(e=>({id:e.dataset.testid ?? e.querySelector('p')?.innerText,value:e.querySelector('p:nth-of-type(2)')?.innerText, text:e.innerText}));
 const today=[...document.querySelectorAll('[data-testid="today-strip"] button')].map(e=>e.innerText);
 const counts=[...document.querySelectorAll('[data-count]')].map(e=>({id:e.dataset.testid,count:e.dataset.count,text:e.innerText}));
 const tasks=[...document.querySelectorAll('[data-testid="task-queue-card"] > div:first-child [data-slot="badge"]')].map(e=>e.innerText);
 return {visibleTestids:Object.keys(all).sort(),ownTextByTestid:all,statTiles:tiles.sort((a,b)=>a.id.localeCompare(b.id)),todayValues:today,countTiles:counts.sort((a,b)=>a.id.localeCompare(b.id)),taskCounts:tasks};
}'''
async def main():
 result={'rollback':'aff263ff1aa707d68994b7f175f83aa9d09306fd','pinnedTimestamp':'2026-10-20T16:47:00.000Z','seed':'fresh browser storage; Math.random returns 0.5 on both before module evaluation','sweep':'same automatic mount sweep on both; Date fixed, interval timers not advanced','roles':{}}
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for role,id,route,summary in HOMES:
   runs={}
   for version,port in [('rollback',8081),('current',8080)]:
    context=await browser.new_context(viewport={'width':1280,'height':1800},timezone_id='UTC',locale='en-US')
    await context.add_init_script('Math.random = () => 0.5;')
    page=await context.new_page()
    await page.clock.set_fixed_time(datetime(2026,10,20,16,47,tzinfo=timezone.utc))
    await page.goto(f'http://localhost:{port}/clinician',wait_until='domcontentloaded',timeout=90000)
    await page.wait_for_function('Boolean(window.__adelante?.j)',timeout=90000)
    await page.evaluate('({id,role,route})=>{window.__adelante.setActingStaff(id,role);window.__adelante.go(route)}',{'id':id,'role':role,'route':route})
    await page.get_by_test_id(summary).wait_for(timeout=90000)
    await page.wait_for_timeout(2000)
    await page.screenshot(path=str(OUT/f'pinned-{version}-{role}.png'))
    runs[version]=await page.evaluate(JS)
    await context.close()
   differences={k:{'rollback':runs['rollback'][k],'current':runs['current'][k]} for k in runs['rollback'] if runs['rollback'][k]!=runs['current'][k]}
   result['roles'][role]={'pass':not differences,'differences':differences,**runs}
   print(role, 'PASS' if not differences else 'FAIL',list(differences),flush=True)
  await browser.close()
 OUT.joinpath('pinned-parity.json').write_text(json.dumps(result,indent=2,ensure_ascii=False))
 assert all(x['pass'] for x in result['roles'].values()),'Pinned parity mismatch; see pinned-parity.json'
asyncio.run(main())

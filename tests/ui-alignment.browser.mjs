// Requires local development and Playwright tooling; all mutations are intercepted.
const {chromium} = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined),headless:true});
const context=await browser.newContext(); const page=await context.newPage();
const health=(await (await context.request.get('http://localhost:8787/api/v1/health')).json()).data;
assert.equal(health.environment,'local');assert.equal(health.authenticationRequired,false);
const data=(await (await context.request.get('http://localhost:8787/api/v1/catalog')).json()).data;
assert(data.sessions.length>0);
const member=data.members[0];
await context.addInitScript(id=>{ if (!localStorage.getItem('bookclub.dev-member')) localStorage.setItem('bookclub.dev-member',id); },member.id);
let fixture={id:'alignment-fixture',title:'Browser-only private set with a longer title',notes:'Review note',movie_ids:data.movies.slice(0,8).map(m=>m.id),revision:0,created_at:'2026-10-05T00:00:00Z'};
let audits=0,failRefresh=false,failEvent=false,personal=false;
let eventIssues=[{path:'event_date',message:'Fixture date invalid'}];
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/api/v1/**',async r=>{
 const path=new URL(r.request().url()).pathname;
 if(path.endsWith('/catalog')&&failRefresh) return r.fulfill({status:503,json:{error:{message:'Browser fixture refresh unavailable'}}});
 if(path.endsWith('/rotation')&&personal) return r.fulfill({json:{data:{cycle_id:null,nominal_slot:member.sort_order,version:0}}});
 if(path.endsWith('/builders')||path.endsWith('/builders/alignment-fixture')) return r.fulfill({json:{data:r.request().method()==='GET'&&path.endsWith('/builders')?[fixture]:fixture}});
 if(path.endsWith('/audit')) {audits++;return r.fulfill({json:{data:[{id:'fixture-audit',action:'update',actor_member_id:member.id,occurred_at:'2026-10-05T00:00:00Z',changes_json:JSON.stringify({before:{event_date:'2026-10-04'},after:{event_date:'2026-10-05',title:'Browser-only event',movie_ids:fixture.movie_ids},rotation_unchanged:true})}]}});}
 if(path.endsWith('/movies/search')) return r.fulfill({json:{data:{local:data.movies.slice(0,8),external:[],lookup:{message:'Browser-only search fixture'}}}});
 if((path.endsWith('/sessions')||path.includes('/sessions/'))&&failEvent&&r.request().method()!=='GET') return r.fulfill({status:422,json:{error:{message:'Invalid event',fields:eventIssues}}});
 if(r.request().method()!=='GET') return r.abort(); return r.continue();
});
// Keep rendered review local even when the snapshot has external artwork.
await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.fallback():r.abort());
const results=[];
const responsiveResults=[];
const columns = locator => locator.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length);
const overflow = () => page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
async function drawerState(width,state) {
 // At 719px both saved drawer states must still give the same mobile layout.
 await page.setViewportSize({width:Math.max(720,width),height:900});
 const toggle=page.getByRole('button',{name:state==='expanded'?'Expand navigation':'Collapse navigation'});
 if(await toggle.count()) await toggle.click();
 await page.setViewportSize({width,height:900});
}
async function checkAvailableWidth(width) {
 for(const screen of ['seen','metrics']) {
  await page.goto(`http://localhost:4173/#/${screen}`);
  await page.locator(screen==='seen'?'.seen-layout':'.metrics-summary').waitFor();
  const chartValues=screen==='metrics'?await page.locator('.chart-row strong').allTextContents():[];
  for(const state of (width>=719?['expanded','collapsed']:['mobile'])) {
   if(state!=='mobile') await drawerState(width,state);
   const content=page.locator(screen==='seen'?'.seen-layout':'.metrics-summary');
   const available=await content.evaluate(e=>e.getBoundingClientRect().width);
   const wide=available>=720;
   assert(!(await overflow()),`${width} ${state} ${screen}: overflow`);
   if(width>=720) {
    assert(await page.locator('.bookclub-shell').evaluate(e=>e.getBoundingClientRect().left>=document.querySelector('.desktop-navigation').getBoundingClientRect().right));
   } else assert(await page.locator('.bottom-nav').isVisible());
   if(screen==='seen') {
    assert.equal(await columns(content),wide?2:1,`${width} ${state}: Seen available-width composition`);
    const copyWidth=await page.locator('.answer-copy').evaluate(e=>e.getBoundingClientRect().width);
    assert(copyWidth>=120,`${width} ${state}: Seen title squeezed`);
    const poster=await page.locator('.answer-card .poster-large').boundingBox();
    assert(poster.width>=(width<390?96:120),`${width} ${state}: poster crushed`);
    const buttons=await page.locator('.answer-actions button').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})));
    assert.equal(buttons.length,2);assert(Math.abs(buttons[0].width-buttons[1].width)<1);assert.deepEqual({...buttons[0],width:0},{...buttons[1],width:0});assert(buttons[0].height>=44);
    if(!wide) assert(await page.locator('.seen-layout').evaluate(e=>e.children[1].getBoundingClientRect().top>=e.children[0].getBoundingClientRect().bottom));
   } else {
    assert.equal(await columns(content),wide?4:2,`${width} ${state}: Metrics summary`);
    assert.equal(await columns(page.locator('.metrics-filters')),wide?6:3,`${width} ${state}: Metrics filters`);
    assert.equal(await columns(page.locator('.metrics-rankings')),wide?2:1,`${width} ${state}: Metrics rankings`);
    assert(await page.locator('.metrics-film-link').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().width>=120&&e.getBoundingClientRect().height>=44)),`${width} ${state}: ranking titles squeezed`);
    assert(await page.locator('.metrics-summary .stat span').evaluateAll(es=>es.every(e=>{
     const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=getComputedStyle(e).font;
     return e.textContent.split(' ').every(word=>ctx.measureText(word).width<=e.getBoundingClientRect().width);
    })),`${width} ${state}: summary label breaks within words`);
    assert(await page.locator('.metrics-filters button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().width>=44&&e.getBoundingClientRect().height>=44)));
    assert.deepEqual(await page.locator('.chart-row strong').allTextContents(),chartValues);
    assert(await page.locator('.metrics-table td,.metrics-list li > strong').evaluateAll(es=>es.every(e=>getComputedStyle(e).textAlign==='right')));
   }
   responsiveResults.push({width,state,screen,available,wide});
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.verification/residual-${width}-${state}-${screen}.png`,fullPage:true});
   if(screen==='metrics') {await page.locator('.metrics-rankings').scrollIntoViewIfNeeded();await page.screenshot({path:`.verification/residual-${width}-${state}-rankings.png`});}
  }
  if(width>=719) await drawerState(width,'expanded');
 }
}
const film=data.movies.find(m=>m.ranking?.rankable)??data.movies[0];
for(const width of (process.env.BOOKCLUB_UI_BEHAVIOUR_ONLY ? [] : [320,390,719,720,768,950,1024,1440])) {
 await page.setViewportSize({width,height:900});
 for(const screen of ['home','history','builder','classics','seen','metrics','event',`event/${data.sessions[0].id}`,`movie/${film.id}`]) {
  await page.goto(`http://localhost:4173/#/${screen}`);if(screen==='home') await page.getByText('Eligible Classics',{exact:true}).waitFor();
  await page.locator('.data-sources').waitFor();await page.waitForTimeout(100);
  if(screen.startsWith('movie/')) await page.getByRole('heading',{name:'Book Club appearances'}).waitFor();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);results.push({width,screen,overflow});assert(!overflow,`${width} ${screen} overflow`);
  await page.screenshot({path:`.verification/pass2-${width}-${screen.replaceAll('/','-')}.png`});
  if(screen==='history'||screen==='classics') for(const pos of [.5,1]) {await page.evaluate(p=>scrollTo(0,document.body.scrollHeight*p),pos);await page.screenshot({path:`.verification/pass2-${width}-${screen}-${pos}.png`});}
 }
 await checkAvailableWidth(width);
 await page.goto('http://localhost:4173/#/builder');await page.getByRole('button',{name:'Open set'}).click();
 await page.getByRole('button',{name:'Delete set',exact:true}).click();await page.getByRole('button',{name:'Keep set'}).waitFor();await page.screenshot({path:`.verification/pass2-${width}-builder-delete.png`,fullPage:true});await page.getByRole('button',{name:'Keep set'}).click();
 await page.getByRole('button',{name:'Review publication'}).click();await page.getByRole('heading',{name:/Publish Browser-only/}).waitFor();await page.screenshot({path:`.verification/pass2-${width}-publication.png`,fullPage:true});
 if(width>=720){await page.getByRole('button',{name:'Collapse navigation'}).click();assert(await page.getByRole('button',{name:'Expand navigation'}).getAttribute('aria-expanded')==='false');await page.locator('#desktop-destinations a').first().focus();await page.screenshot({path:`.verification/pass2-${width}-collapsed.png`});await page.getByRole('button',{name:'Expand navigation'}).click();}
}
await fs.writeFile('.verification/pass2-width-results.json',JSON.stringify(results));
await page.goto('http://localhost:4173/#/history');const audit=page.getByRole('button',{name:'Audit',exact:true}).first();await audit.click();await page.getByRole('heading',{name:'Changes to this event'}).waitFor();await audit.click();assert(await page.getByRole('heading',{name:'Changes to this event'}).count()===0);await audit.click();assert(audits===1);
await page.locator('.archive-tools select').nth(1).selectOption(member.id);await page.locator('.archive-tools select').first().selectOption({index:2});
await page.goto('http://localhost:4173/#/event');await page.getByLabel('Actual event date',{exact:true}).fill('');await page.getByRole('button',{name:'Save event',exact:true}).click();await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='event_date');
await page.getByLabel('Actual event date',{exact:true}).fill('2026-10-05');await page.getByLabel('Search saved films & TMDB').fill('fixture');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:/^Add /}).first().waitFor();for(const add of await page.getByRole('button',{name:/^Add /}).all()) await add.click();await page.screenshot({path:'.verification/pass2-event-long-lineup.png',fullPage:true});failEvent=true;await page.getByRole('button',{name:'Save event',exact:true}).click();await page.getByText('Fixture date invalid',{exact:true}).waitFor();assert(await page.getByLabel('Actual event date',{exact:true}).inputValue()==='2026-10-05');
// R03: reject the populated editor without touching D1; preserve every entered value.
const editing=data.sessions.find(s=>s.kind==='hosted'&&s.cycle_slot!==1&&s.movies.length);
assert(editing);await page.goto(`http://localhost:4173/#/event/${editing.id}`);
await page.getByText('Optional title & notes',{exact:true}).click();
await page.getByLabel('Title or theme (optional)').fill('Browser-only retained title');
await page.getByLabel('Notes (optional)').fill('Browser-only retained notes');
const retained=await page.locator('.event-workflow').evaluate(root=>[...root.querySelectorAll('input,textarea,select')].map(e=>({name:e.name,value:e.value,checked:e.checked})));
async function rejectEditor(issues) {
 eventIssues=issues;const rejection=page.waitForResponse(r=>r.url().includes('/sessions/')&&r.status()===422);await page.getByRole('button',{name:'Save corrections'}).click();await rejection;
 await page.waitForFunction(()=>!document.querySelector('button[form="event-form"]').disabled);
 assert.deepEqual(await page.locator('.event-workflow').evaluate(root=>[...root.querySelectorAll('input,textarea,select')].map(e=>({name:e.name,value:e.value,checked:e.checked}))),retained);
 assert.equal(await page.locator('.lineup-list li').count(),editing.movies.length);
}
await rejectEditor([{path:'notes',message:'Fixture notes invalid'},{path:'event_date',message:'Fixture date invalid'}]);
await page.getByText('Fixture notes invalid',{exact:true}).waitFor();
await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='event_date');
assert.equal(await page.locator('[name="event_date"]').getAttribute('aria-describedby'),'error-event_date');
await rejectEditor([{path:'cycle_slot',message:'Slot 5 is for Classics.'},{path:'cycle_id',message:'Choose an existing cycle.'}]);
await page.getByText(/Could not save the event\. Nominal slot:/).waitFor();
await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='alert');
assert.equal(await page.locator('.event-workflow [name="cycle_slot"],.event-workflow [name="cycle_id"]').count(),0);
assert(!/cycle_slot|cycle_id/.test(await page.locator('.event-workflow [role="alert"]').innerText()));
await rejectEditor([{path:'future_internal_field.value',message:'future_internal_field invalid'}]);
await page.getByText(/Some event details could not be validated/).waitFor();
assert(!(await page.locator('.event-workflow [role="alert"]').innerText()).includes('future_internal_field'));
await rejectEditor([{path:'kind',message:'Fixture kind invalid'}]);await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='kind');
assert(await page.locator('[name="kind"]').evaluate(e=>e.closest('label').nextElementSibling.id==='error-kind'));
await rejectEditor([{path:'date_precision',message:'Fixture precision invalid'}]);await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='date_precision');
assert(await page.locator('[name="date_precision"]').evaluate(e=>e.closest('details').open&&e.closest('label').nextElementSibling.id==='error-date_precision'));
await page.getByText('Optional title & notes',{exact:true}).click();
await rejectEditor([{path:'notes',message:'Fixture disclosed notes invalid'},{path:'title',message:'Fixture disclosed title invalid'}]);
await page.waitForFunction(()=>document.activeElement?.getAttribute('name')==='title');
assert(await page.locator('[name="title"]').isVisible());
await page.screenshot({path:'.verification/residual-edit-validation.png',fullPage:true});failEvent=false;
await page.goto('http://localhost:4173/#/home');failRefresh=true;await page.getByRole('button',{name:'Refresh BookClub data',exact:true}).click();await page.getByText('Could not refresh. Showing the last loaded journal.').waitFor();assert(await page.getByText('Eligible Classics',{exact:true}).isVisible());failRefresh=false;
personal=true;await page.reload();await page.getByRole('heading',{name:'This is your turn'}).waitFor();await page.screenshot({path:'.verification/pass2-personal.png'});
personal=false;await page.evaluate(id=>localStorage.setItem('bookclub.dev-member',id),data.members[1].id);await page.reload();await page.getByRole('heading',{name:'Current turn',exact:true}).waitFor();await page.screenshot({path:'.verification/pass2-other-turn.png'});await page.evaluate(id=>localStorage.setItem('bookclub.dev-member',id),member.id);await page.reload();
await page.getByText('Admin · rotation correction',{exact:true}).click();await page.getByRole('button',{name:'Correct current turn'}).click();await page.screenshot({path:'.verification/pass2-admin.png'});
await page.getByText('Local development tools',{exact:true}).click();await page.getByRole('button',{name:'Refresh Dev DB from Production'}).click();await page.getByRole('button',{name:'Confirm local replacement'}).waitFor();await page.screenshot({path:'.verification/pass2-dev-confirm.png'});
await page.goto('http://localhost:4173/#/classics');for(const tab of ['Needs Data','Disqualified','Ranked']) {await page.getByRole('button',{name:new RegExp(`^${tab} \\(`)}).click();await page.screenshot({path:`.verification/pass2-${tab.replaceAll(' ','-')}.png`});}await page.locator('.ranking-row summary').first().click();await page.getByText('Admin · score maintenance',{exact:true}).click();
await page.goto('http://localhost:4173/#/metrics');for(const button of await page.locator('.metrics-filters button').all()) await button.click();await page.getByText('Admin · metadata maintenance',{exact:true}).click();await page.screenshot({path:'.verification/pass2-metrics-admin.png',fullPage:true});
await page.goto(`http://localhost:4173/#/movie/${film.id}`);await page.getByText('Technical identifiers & artwork',{exact:true}).click();await page.getByText('Classics membership & score maintenance',{exact:true}).click();await page.screenshot({path:'.verification/pass2-film-disclosures.png',fullPage:true});
await page.setViewportSize({width:720,height:900});const collapse=page.getByRole('button',{name:'Collapse navigation'});await collapse.focus();await page.keyboard.press('Enter');assert(await page.getByRole('button',{name:'Expand navigation'}).getAttribute('aria-expanded')==='false');await page.keyboard.press('Enter');assert(await page.getByRole('button',{name:'Collapse navigation'}).getAttribute('aria-expanded')==='true');
for(const width of [320,390,719,720,768,1440]) {await page.setViewportSize({width,height:900});const targets=await page.locator('button.button,nav a,summary').evaluateAll(elements=>elements.map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height).every(r=>r.width>=44&&r.height>=44));assert(targets,`Touch targets at ${width}`);}
assert.deepEqual(errors,[]);await fs.writeFile('.verification/pass2-results.json',JSON.stringify({results,responsiveResults,errors,assertions:'audit cache/toggle, inline deletion cancellation, navigation state/focus, API validation routing/fallback/disclosure/focus/input preservation, available-width grids/title/poster/target parity/chart values, stale catalog, personal turn and disclosures passed'},null,2));await browser.close();console.log(`${results.length} route/width checks and ${responsiveResults.length} available-width checks passed; behavioural assertions passed.`);


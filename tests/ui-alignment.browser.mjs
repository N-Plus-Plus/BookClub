// Requires local development and Playwright tooling; all mutations are intercepted.
const {chromium} = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined),headless:true});
const context=await browser.newContext(); const page=await context.newPage();
const data=(await (await context.request.get('http://localhost:8787/api/v1/catalog')).json()).data;
assert(data.sessions.length>0);
const member=data.members[0];
await context.addInitScript(id=>{ if (!localStorage.getItem('bookclub.dev-member')) localStorage.setItem('bookclub.dev-member',id); },member.id);
let fixture={id:'alignment-fixture',title:'Browser-only private set with a longer title',notes:'Review note',movie_ids:data.movies.slice(0,8).map(m=>m.id),revision:0,created_at:'2026-10-05T00:00:00Z'};
let audits=0,failRefresh=false,failEvent=false,personal=false;
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/api/v1/**',async r=>{
 const path=new URL(r.request().url()).pathname;
 if(path.endsWith('/catalog')&&failRefresh) return r.fulfill({status:503,json:{error:{message:'Browser fixture refresh unavailable'}}});
 if(path.endsWith('/rotation')&&personal) return r.fulfill({json:{data:{cycle_id:null,nominal_slot:member.sort_order,version:0}}});
 if(path.endsWith('/builders')||path.endsWith('/builders/alignment-fixture')) return r.fulfill({json:{data:r.request().method()==='GET'&&path.endsWith('/builders')?[fixture]:fixture}});
 if(path.endsWith('/audit')) {audits++;return r.fulfill({json:{data:[{id:'fixture-audit',action:'update',actor_member_id:member.id,occurred_at:'2026-10-05T00:00:00Z',changes_json:JSON.stringify({before:{event_date:'2026-10-04'},after:{event_date:'2026-10-05',title:'Browser-only event',movie_ids:fixture.movie_ids},rotation_unchanged:true})}]}});}
 if(path.endsWith('/movies/search')) return r.fulfill({json:{data:{local:data.movies.slice(0,8),external:[],lookup:{message:'Browser-only search fixture'}}}});
 if(path.endsWith('/sessions')&&failEvent) return r.fulfill({status:422,json:{error:{message:'Invalid event',fields:[{path:'event_date',message:'Fixture date invalid'}]}}});
 if(r.request().method()!=='GET') return r.abort(); return r.continue();
});
const results=[];
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
 await page.goto('http://localhost:4173/#/builder');await page.getByRole('button',{name:'Open set'}).click();
 await page.getByRole('button',{name:'Delete set',exact:true}).click();await page.getByRole('button',{name:'Keep set'}).waitFor();await page.screenshot({path:`.verification/pass2-${width}-builder-delete.png`,fullPage:true});await page.getByRole('button',{name:'Keep set'}).click();
 await page.getByRole('button',{name:'Review publication'}).click();await page.getByRole('heading',{name:/Publish Browser-only/}).waitFor();await page.screenshot({path:`.verification/pass2-${width}-publication.png`,fullPage:true});
 if(width>=720){await page.getByRole('button',{name:'Collapse navigation'}).click();assert(await page.getByRole('button',{name:'Expand navigation'}).getAttribute('aria-expanded')==='false');await page.locator('#desktop-destinations a').first().focus();await page.screenshot({path:`.verification/pass2-${width}-collapsed.png`});await page.getByRole('button',{name:'Expand navigation'}).click();}
}
await fs.writeFile('.verification/pass2-width-results.json',JSON.stringify(results));
await page.goto('http://localhost:4173/#/history');const audit=page.getByRole('button',{name:'Audit',exact:true}).first();await audit.click();await page.getByRole('heading',{name:'Changes to this event'}).waitFor();await audit.click();assert(await page.getByRole('heading',{name:'Changes to this event'}).count()===0);await audit.click();assert(audits===1);
await page.locator('.archive-tools select').nth(1).selectOption(member.id);await page.locator('.archive-tools select').first().selectOption({index:2});
await page.goto('http://localhost:4173/#/event');await page.getByLabel('Actual event date',{exact:true}).fill('');await page.getByRole('button',{name:'Save event',exact:true}).click();assert(await page.getByLabel('Actual event date',{exact:true}).evaluate(e=>e===document.activeElement));
await page.getByLabel('Actual event date',{exact:true}).fill('2026-10-05');await page.getByLabel('Search saved films & TMDB').fill('fixture');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:/^Add /}).first().waitFor();for(const add of await page.getByRole('button',{name:/^Add /}).all()) await add.click();await page.screenshot({path:'.verification/pass2-event-long-lineup.png',fullPage:true});failEvent=true;await page.getByRole('button',{name:'Save event',exact:true}).click();await page.getByText('Fixture date invalid',{exact:true}).waitFor();assert(await page.getByLabel('Actual event date',{exact:true}).inputValue()==='2026-10-05');
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
assert.deepEqual(errors,[]);await fs.writeFile('.verification/pass2-results.json',JSON.stringify({results,errors,assertions:'audit cache/toggle, inline deletion cancellation, navigation state/focus, validation/focus/input preservation, stale catalog, personal turn and disclosures passed'},null,2));await browser.close();console.log(`${results.length} route/width checks passed; behavioural assertions passed.`);


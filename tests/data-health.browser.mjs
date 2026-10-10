import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const out='.verification/data-health';await fs.mkdir(out,{recursive:true});
const catalog=metricsFixture(),requests=[],errors=[],checks=[];
const film={id:catalog.movies[0].id,title:'A long film title for inspecting multiple overlapping locations and individual exceptions',year:2000,external_ids:[{provider:'imdb',external_id:'tt1234567'},{provider:'tmdb',external_id:'123'}],locations:[{kind:'history',label:'Active History · Hosted · A participant with a long name · 3 appearances'},{kind:'dq',label:'Disqualified Classic'},{kind:'builder',label:'Private saved Builder membership · 2 sets'}],issues:[{code:'director',category:'metadata',priority:'actionable',label:'Missing director',explanation:'omdb: unchecked; tmdb: inconclusive · attempted 2026-10-01T00:00:00.000Z'},{code:'identity',category:'identity',priority:'actionable',label:'Conflicting IMDb identity',explanation:'MDBList claims tt9999999; canonical identity is tt1234567.',provider:'mdblist',identity:'tt9999999',checkedAt:'2026-10-01T00:00:00.000Z'},{code:'poster',category:'artwork',priority:'confirmed',label:'Missing poster artwork',explanation:'Provider confirmed absence.'}]};
const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('bookclub.dev-member','m1'));
await page.route('**/api/v1/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;requests.push({path,method:request.method()});let data;
  if(path.endsWith('/health'))data={status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
  else if(path.endsWith('/auth/me'))data={viewer:{...catalog.members[0],avatar:0,role:'admin'}};
  else if(path.endsWith('/auth/preferences'))data={show_ai:false};
  else if(path.endsWith('/catalog/compact'))data={...catalog,sessions:catalog.sessions.map(({movies,...s})=>({...s,movie_ids:movies.map(m=>m.id)}))};
  else if(path.endsWith('/rotation'))data={id:1,nominal_slot:2,cycle_id:'c',version:1,updated_at:''};
  else if(path.endsWith('/predictions')||path.endsWith('/builders'))data=[];
  else if(path.endsWith('/maintenance/jobs'))data={jobs:[]};
  else if(path.endsWith('/admin/data-health'))data=url.searchParams.get('q')?{films:[],scanned:0,next:null,partial:false}:url.searchParams.has('after')?{films:[],scanned:1,next:null,partial:false}:{films:[film],scanned:80,next:'next',partial:false};
  else if(path.endsWith('/movies/maintenance-coverage'))data={checks:[],negativeScores:[],enrichment:[],fields:[],evidence:[],fieldsSupported:true,evidenceSupported:true,unavailable:{tmdb:null,omdb:null,mdblist:null},next:null};
  else if(path.includes('/movies/'))data={...catalog.movies[0],appearances:[]};
  else throw Error('Unexpected synthetic API '+path);
  await route.fulfill({contentType:'application/json',body:JSON.stringify({data})});
});
try{
  for(const width of [320,390,720,1440]){
    await page.setViewportSize({width,height:1000});await page.goto(`${process.env.BOOKCLUB_UI_URL||'http://localhost:4173'}/?width=${width}#/admin`);
    await page.getByRole('heading',{name:'Data health and exceptions',exact:true}).waitFor();await page.locator('.health-film').waitFor();await page.evaluate(()=>document.fonts.ready);
    const diagnostic=page.locator('.data-health');await diagnostic.locator('summary').focus();await page.keyboard.press('Enter');
    assert.equal(await diagnostic.locator('.health-issues li').count(),2);assert.equal(await diagnostic.locator('a').getAttribute('href'),`#/movie/${film.id}`);
    await diagnostic.locator('select').nth(1).selectOption('all');assert.equal(await diagnostic.locator('.health-issues li').count(),3);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);
    const geometry=await diagnostic.locator('input,select,button,summary').evaluateAll(elements=>elements.map(e=>({tag:e.tagName,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})));assert(geometry.every(g=>g.height>=44),JSON.stringify(geometry));
    await page.screenshot({path:`${out}/admin-${width}.png`,fullPage:true});await diagnostic.screenshot({path:`${out}/worklist-${width}.png`});
    await diagnostic.locator('select').nth(0).selectOption('identity');assert.equal(await diagnostic.locator('.health-issues li').count(),1);
    await diagnostic.getByRole('button',{name:'Inspect next 80 films'}).click();await diagnostic.getByText(/81 films inspected/).waitFor();
    await diagnostic.getByLabel('Find film by title').fill('Nothing matches');await diagnostic.getByRole('button',{name:'Search / refresh'}).click();await diagnostic.getByText(/No films found/).waitFor();
    await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push({width,geometry,overflow:false});
  }
  assert.deepEqual(errors,[]);assert(requests.every(r=>r.method==='GET'));await fs.writeFile(`${out}/results.json`,JSON.stringify({checks,requests,errors},null,2));console.log('Data health Admin rendered checks passed at 320, 390, 720 and 1440px; filters, navigation, paging, empty state and read-only requests passed.');
}finally{await browser.close();}

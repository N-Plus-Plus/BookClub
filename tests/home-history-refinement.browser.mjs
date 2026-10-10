import assert from 'node:assert/strict';
const uiBase=process.env.BOOKCLUB_UI_URL || 'http://localhost:4173';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture.ts';
import { rankMovie } from '../shared/ranking.ts';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const catalog=metricsFixture();catalog.movies.forEach((m,i)=>{m.classic=true;m.seen=catalog.members.map(member=>({member_id:member.id,seen:0,updated_at:''}));m.ranking=rankMovie(m.scores,m.seen,catalog.members);m.release_date=i<2?'2025-04-01':null;});
catalog.cycles=[{id:'c55',ordinal:55,title:null,rough_date:'2026-10-01',import_source:null,import_key:null,created_at:'',updated_at:''}];
catalog.sessions=catalog.sessions.filter(s=>!s.deleted_at).map((s,i)=>({...s,cycle_id:'c55',cycle_slot:i+1,completed_turn_version:i}));
catalog.members[1].display_name='A member with an exceptionally long recorded name';
catalog.sessions[0].date_precision='cycle_rough';
catalog.movies[3].director=null;
const pending={...catalog.movies[0],id:'pending',title:'A long unseen film title with nine genuine source scores',director:null,seen:[],scores:[...catalog.movies[0].scores,...catalog.movies[1].scores,...catalog.movies[3].scores]};pending.ranking=rankMovie(pending.scores,pending.seen,catalog.members);catalog.movies.push(pending);
let set={id:'private',owner_member_id:'m1',title:'Synthetic private set',notes:null,movie_ids:['a','b'],revision:1,created_at:'2026-10-01',updated_at:''};
await context.addInitScript(()=>localStorage.setItem('bookclub.dev-member','m1'));
await context.route('**/api/v1/**',async route=>{
 const path=new URL(route.request().url()).pathname,method=route.request().method();let data;
 if(path.endsWith('/health'))data={status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
 else if(path.endsWith('/auth/preferences'))data={show_ai:false};
 else if(path.endsWith('/predictions'))data=[];
 else if(path.endsWith('/auth/me'))data={viewer:{...catalog.members[0],display_name:'An exceptionally long account member name',role:'member'}};
 else if(path.endsWith('/rotation'))data={id:1,nominal_slot:2,cycle_id:'c55',version:0,updated_at:''};
 else if(path.endsWith('/metrics/enrichment'))data=metricsEnrichmentFixture();
 else if(path.endsWith('/catalog/compact'))data={...catalog,sessions:catalog.sessions.map(({movies,...s})=>({...s,movie_ids:movies.map(m=>m.id)}))};
 else if(path.endsWith('/builders')&&method==='GET')data=[set];
 else if(path.endsWith('/builders/private')&&method==='PUT'){set={...set,...route.request().postDataJSON(),revision:set.revision+1};data=set;}
 else if(path.includes('/movies/preview/tmdb/'))data={provider:'tmdb',externalId:'42',title:'External preview',year:2026,runtime:85,overview:'Synthetic preview',genres:[],assets:[],release_date:'2026-01-01',original_title:null,director:'Synthetic Director'};
 else if(path.includes('/movies/')){const m=catalog.movies.find(m=>path.endsWith('/'+m.id));assert(m,path);data={...m,appearances:[]};}
 else throw Error(`Unexpected synthetic request: ${method} ${path}`);
 await route.fulfill({json:{data}});
});
await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort());
const out='.verification/home-history-refinement';await fs.mkdir(out,{recursive:true});const measurements=[];
const baseline=process.env.BOOKCLUB_REFINEMENT_PHASE==='before';
const go=async path=>{await page.evaluate(p=>location.hash='/'+p,path);await page.locator('main .loading-placeholder:visible').waitFor({state:'hidden'});};
const shot=async(name,width)=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${width}: overflow`);};
const headingCheck=async()=>{
 const geometry=await page.locator('.page-heading').evaluate(e=>{const h=e.querySelector('h1'),s=getComputedStyle(e),hs=getComputedStyle(h),r=e.getBoundingClientRect(),hr=h.getBoundingClientRect();return {top:s.paddingTop,bottom:s.paddingBottom,gap:hs.gap,margin:hs.margin,visibleTop:hr.top-r.top,visibleBottom:r.bottom-hr.bottom};});
 assert.equal(geometry.top,'24px');assert.equal(geometry.bottom,'24px');assert.equal(geometry.gap,'16px');assert.equal(geometry.margin,'0px');assert(geometry.visibleTop>=24);assert(geometry.visibleBottom>=24);return geometry;
};
const helpCheck=async()=>{
 const results=await page.locator('.source-scores-summary:visible').evaluateAll(es=>es.map(e=>{const b=e.querySelector('button'),br=b.getBoundingClientRect(),icon=b.querySelector('svg').getBoundingClientRect(),row=e.querySelector('p').getBoundingClientRect(),owner=e.closest('.home-rank-card,.classics-ranking-row,.detail-identity,.seen-content section')||e.parentElement,or=owner.getBoundingClientRect();const meta=owner.querySelector('.home-candidate-seen')?.getBoundingClientRect();return {target:br.toJSON(),icon:icon.toJSON(),row:row.toJSON(),owner:or.toJSON(),seen:meta?.toJSON()};}));
 for(const r of results){assert(r.target.width>=44&&r.target.height>=44);assert(r.target.left>=r.owner.left-1&&r.target.right<=r.owner.right+1&&r.target.top>=r.owner.top-1&&r.target.bottom<=r.owner.bottom+1,JSON.stringify(r));assert(Math.abs(r.icon.right-r.row.right)<1);assert(r.target.bottom<=r.row.top);if(r.seen)assert(Math.abs(r.icon.bottom-r.seen.bottom)<1,JSON.stringify(r));}
 return results;
};
const accountCheck=async()=>{
 const trigger=page.locator('.account-menu-trigger');await trigger.focus();await page.keyboard.press('Enter');await page.locator('.account-menu-dropdown').waitFor();
 const r=await page.locator('.account-menu-dropdown').boundingBox();assert(r.x>=0&&r.x+r.width<=page.viewportSize().width);assert(r.y>=0&&r.y+r.height<=page.viewportSize().height);
 await page.keyboard.press('Escape');assert(await trigger.evaluate(e=>document.activeElement===e));
 const inset=await page.evaluate(()=>document.querySelector('.site-header').getBoundingClientRect().right-document.querySelector('.account-menu').getBoundingClientRect().right);assert.equal(inset,12);return {inset,dropdown:r};
};
try{
 for(const width of [320,390,720,951,1440]){
  await page.setViewportSize({width,height:900});await page.goto(uiBase+'/#/home');await page.getByRole('heading',{name:'Club timeline',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const rects=await page.locator('.bookclub-shell, main, .turn-card, .home-session-card, .home-rank-card, .stats-grid').evaluateAll(es=>es.map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON(),padding:getComputedStyle(e).padding})));
  if(width<720)for(const r of rects.filter(r=>r.class!=='bookclub-shell')){assert.equal(r.rect.left,16);assert.equal(r.rect.right,width-16);}
  if(baseline){measurements.push({width,rects});continue;}
  const homeHeading=await headingCheck();const account=await accountCheck();const infos=await helpCheck();
  const strips=await page.locator('.stats-grid').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,columns:getComputedStyle(e).gridTemplateColumns,pads:[...e.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>getComputedStyle(c).paddingLeft)})));
  assert.deepEqual(strips[0],strips[1]);assert.deepEqual(strips[1],strips[2]);for(const strip of strips)assert(strip.pads.every(p=>p===(width<720?'16px':'32px')));
  const snapshot=page.locator('section').filter({has:page.getByRole('heading',{name:'Classics snapshot',exact:true})});assert.equal(await snapshot.getByRole('link',{name:'View all'}).count(),0);assert.equal(await page.getByRole('link',{name:'View all',exact:true}).count(),1);
  assert(await page.locator('.home-session-card h3').evaluate(h=>h.nextElementSibling.className==='eyebrow'));assert.match(await page.locator('.home-session-card .eyebrow').innerText(),/^Cycle started /);
  const candidates=await page.locator('.home-rank-card').evaluateAll(es=>es.map(e=>({copy:[...e.querySelector('.movie-copy').children].map(c=>({class:c.className,text:c.textContent,rect:c.getBoundingClientRect().toJSON()})),counts:e.textContent.match(/\d+ Seen · \d+ Haven't · \d+ Unknown/g),poster:e.querySelector('.poster').getBoundingClientRect().toJSON(),row:e.querySelector('.ranking-source-scores').getBoundingClientRect().toJSON()})));
  for(const c of candidates){assert.equal(c.counts.length,1);assert.equal(c.copy[0].class,'movie-title');assert.equal(c.copy[1].class,'meta');assert.equal(c.copy.at(-1).class,'meta compact-seen-summary home-candidate-seen');assert.equal(c.poster.width,56);assert.equal(c.poster.height,84);assert(c.copy.every(v=>v.rect.left===c.copy[0].rect.left));assert(c.row.top>=c.copy.at(-1).rect.bottom);}
  assert.equal(await page.locator('.home-session-card .movie-title + .meta').first().evaluate(e=>getComputedStyle(e).marginTop),'4px');await shot('home',width);
  const help=page.getByRole('button',{name:'Explain score abbreviations',exact:true}).first();await help.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();
  const columns=await page.locator('dialog tr').evaluateAll(es=>es.map(e=>[...e.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>({width:c.getBoundingClientRect().width,align:getComputedStyle(c).textAlign}))));
  for(const row of columns){assert.deepEqual(row.map(c=>c.align),width<720?['left','left']:['left','left','right','right']);if(width>=720)assert(Math.abs(row[2].width-row[3].width)<1);}
  await shot('glossary',width);await page.keyboard.press('Escape');assert(await help.evaluate(e=>document.activeElement===e));
  await go('history');await page.locator('.history-event').first().waitFor();await headingCheck();assert.equal(await page.getByLabel(/^Cycle/).count(),1);assert.equal(await page.getByLabel(/^Host/).count(),1);
  assert(await page.locator('.history-event-heading').evaluateAll(es=>es.every(e=>e.firstElementChild.tagName==='H3'&&e.firstElementChild.nextElementSibling.className==='eyebrow')));
  const contextGeometry=await page.locator('.history-cycle-context').first().evaluate(e=>{const r=e.getBoundingClientRect(),a=e.firstElementChild.getBoundingClientRect(),b=e.lastElementChild.getBoundingClientRect();return {left:a.left-r.left,right:r.right-b.right,align:getComputedStyle(e.lastElementChild).justifyContent};});assert.equal(contextGeometry.left,0);assert.equal(contextGeometry.right,0);assert.equal(contextGeometry.align,'flex-end');
  assert.equal(await page.locator('.history-event .movie-title + .meta').first().evaluate(e=>getComputedStyle(e).marginTop),'4px');await shot('history',width);
  await page.getByLabel(/^Host/).selectOption('m2');assert(await page.locator('.history-event h3').evaluateAll(es=>es.every(e=>e.textContent.includes('exceptionally long'))));await page.getByLabel(/^Host/).selectOption('all');await page.getByLabel(/^Cycle/).selectOption('c55');
  for(const route of ['classics','movie/a','seen']){await go(route);await page.locator(route==='classics'?'.classics-ranking-row':route==='seen'?'.seen-content':'.detail-identity').first().waitFor();await headingCheck();await helpCheck();if(route==='seen')assert.equal(await page.locator('.source-scores-summary:visible').count(),1);await accountCheck();await shot(route.replace('/','-'),width);}
  if(width>=720){await page.getByRole('button',{name:'Collapse navigation',exact:true}).click();await accountCheck();await headingCheck();await shot('collapsed-seen',width);await page.getByRole('button',{name:'Expand navigation',exact:true}).click();}
  measurements.push({width,rects,homeHeading,account,infos,strips,candidates,columns,contextGeometry});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/${baseline?'before':'after'}-results.json`,JSON.stringify({measurements,errors},null,2));console.log('Home/History refinement checks passed at five widths.');
}finally{await browser.close();}

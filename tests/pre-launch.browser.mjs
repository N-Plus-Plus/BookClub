import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture.ts';
import { rankMovie } from '../shared/ranking.ts';
const {chromium}=await import('../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const catalog=metricsFixture();catalog.movies.forEach((m,i)=>{m.classic=true;m.seen=catalog.members.map(member=>({member_id:member.id,seen:0,updated_at:''}));m.ranking=rankMovie(m.scores,m.seen,catalog.members);m.release_date=i<2?'2025-04-01':null;});
catalog.cycles=[{id:'c55',ordinal:55,title:null,rough_date:'2026-10-01',import_source:null,import_key:null,created_at:'',updated_at:''}];
catalog.sessions=catalog.sessions.filter(s=>!s.deleted_at).map((s,i)=>({...s,cycle_id:'c55',cycle_slot:i+1,completed_turn_version:i}));
let set={id:'private',owner_member_id:'m1',title:'Synthetic private set',notes:null,movie_ids:['a','b'],revision:1,created_at:'2026-10-01',updated_at:''};
await context.addInitScript(()=>localStorage.setItem('bookclub.dev-member','m1'));
await context.route('**/api/v1/**',async route=>{
 const path=new URL(route.request().url()).pathname,method=route.request().method();let data;
 if(path.endsWith('/health'))data={status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
 else if(path.endsWith('/auth/me'))data={viewer:{...catalog.members[0],role:'member'}};
 else if(path.endsWith('/rotation'))data=null;
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
const out='.verification/pre-launch';await fs.mkdir(out,{recursive:true});const measurements=[];
const go=async path=>{await page.evaluate(p=>location.hash='/'+p,path);await page.locator('main .loading-placeholder:visible').waitFor({state:'hidden'});};
const shot=async(name,width)=>{await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${width}: overflow`);};
try{
 for(const width of [320,390,720,951,1440]){
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/home');await page.getByRole('heading',{name:'Club timeline',exact:true}).waitFor();
  const strips=await page.locator('.home-dashboard .stats-grid').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,columns:getComputedStyle(e).gridTemplateColumns})));
  assert.deepEqual(strips[1],strips[2],'Timeline/Snapshot alignment');assert.deepEqual(strips[0],strips[1],'adjacent strip alignment');
  await shot('home',width);
  const infos=await page.locator('.source-scores-summary').evaluateAll(es=>es.map(e=>({button:e.querySelector('button').getBoundingClientRect().toJSON(),row:e.querySelector('p').getBoundingClientRect().toJSON()})));measurements.push({width,strips,infos});
  await page.getByRole('button',{name:'Explain score abbreviations'}).first().click();assert.equal(await page.locator('dialog tbody tr').count(),9);await shot('glossary',width);await page.getByRole('button',{name:'Close score abbreviations'}).click();
  for(const route of ['history','classics','seen','builder','metrics']){await go(route);await page.getByRole('heading',{level:1}).filter({hasText:route==='metrics'?'Metrics':route==='seen'?'Seen':route[0].toUpperCase()+route.slice(1)}).waitFor();await shot(route,width);await page.locator('footer summary').click();await shot(route+'-footer',width);await page.locator('footer summary').click();}
  await go('builder');await page.getByRole('button',{name:'Open set',exact:true}).click();const title=page.locator('input[maxlength="300"]');await title.fill('Pending private draft');await shot('builder-editor',width);
  await page.locator('.builder-lineup .movie-link').first().click();await page.getByRole('heading',{name:'Film detail',exact:true}).waitFor();await page.locator('.detail-identity').waitFor();await shot('detail',width);await page.getByRole('button',{name:'Back',exact:true}).click();await title.waitFor();assert.equal(await title.inputValue(),'Pending private draft');
  await page.goForward();await page.getByRole('heading',{name:'Film detail',exact:true}).waitFor();await page.goBack();await title.waitFor();assert.equal(await title.inputValue(),'Pending private draft');
  await go('metrics');for(const name of ['Top 5','Tastes','Breakdowns','Records']){await page.getByRole('tab',{name,exact:true}).click();await shot('metrics-'+name.replaceAll(' / ','-'),width);}
  if(width>=720){await page.getByRole('button',{name:'Collapse navigation',exact:true}).click();await shot('collapsed-metrics',width);await page.getByRole('button',{name:'Expand navigation',exact:true}).click();}
  await go('movie/a');await page.reload();await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('heading',{name:'Home',exact:true}).waitFor();
  await page.goto('http://localhost:4173/#/preview/tmdb/42');await page.getByRole('button',{name:'Back',exact:true}).waitFor();await shot('preview-direct',width);await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('heading',{name:'Home',exact:true}).waitFor();
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({widths:[320,390,720,951,1440],errors,measurements},null,2));console.log('Pre-launch rendered/navigation checks passed at five widths.');
}finally{await browser.close();}

import assert from 'node:assert/strict';
const uiBase=process.env.BOOKCLUB_UI_URL || 'http://localhost:4173';
import fs from 'node:fs/promises';
import { metricsFixture, metricsFilm } from './metrics-fixture.ts';
import { rankMovie } from '../shared/ranking.ts';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const catalog=metricsFixture();catalog.movies.forEach(m=>{m.classic=true;m.seen=[];m.ranking=rankMovie(m.scores,m.seen,catalog.members);});
const candidate=metricsFilm('candidate',{classic:true});candidate.seen=catalog.members.map(m=>({member_id:m.id,seen:0,updated_at:''}));candidate.ranking=rankMovie(candidate.scores,candidate.seen,catalog.members);catalog.movies.push(candidate);
let classics=false, predictions=false;
await context.addInitScript(()=>localStorage.setItem('bookclub.dev-member','m1'));
await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.fallback():r.abort());
await context.route('**/api/v1/**',async route=>{
 const path=new URL(route.request().url()).pathname;let data;
 if(path.endsWith('/health'))data={status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
 else if(path.endsWith('/auth/preferences'))data={show_ai:predictions};
 else if(path.endsWith('/predictions'))data=predictions?[{member_id:'m1',movie_id:'candidate',id:'prediction',created_at:'',updated_at:''}]:[];
 else if(path.endsWith('/auth/me'))data={viewer:{...catalog.members[0],role:'admin'}};
 else if(path.endsWith('/rotation'))data={id:1,nominal_slot:classics?5:1,cycle_id:null,version:0,updated_at:''};
 else if(path.endsWith('/metrics/enrichment'))data={movies:{}};
 else if(path.endsWith('/catalog/compact'))data={...catalog,sessions:catalog.sessions.map(({movies,...s})=>({...s,movie_ids:movies.map(m=>m.id)}))};
 else throw Error('Unexpected synthetic API '+path);
 await route.fulfill({json:{data}});
});
const out='.verification/mobile-corrections';await fs.mkdir(out,{recursive:true});const results=[];
const shot=async name=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' page overflow');await page.screenshot({path:out+'/'+name+'.png',fullPage:true});};
try{
 for(const width of [320,360,375,390,430,720])for(const turn of ['member','classics']){
  classics=turn==='classics';await page.setViewportSize({width,height:900});await page.goto(uiBase+'/#/home');await page.reload();await page.locator('.turn-card').waitFor();await page.evaluate(()=>document.fonts.ready);
  const action=page.locator('.turn-actions a[href="#/event"]');
  // Measure the preceding equal-column layout using the same rendered content.
  const baseline=await page.addStyleTag({content:'.turn-row {grid-template-columns:repeat(2,minmax(0,1fr))!important}.turn-actions .button {white-space:normal!important}'});
  const before=await action.evaluate(e=>({available:e.parentElement.getBoundingClientRect().width,button:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}));await baseline.evaluate(e=>e.remove());
  const geometry=await action.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),range=document.createRange();range.selectNodeContents(e.lastChild);return {rect:r.toJSON(),font:s.fontSize,padding:s.paddingInline,labelLines:[...range.getClientRects()].filter(r=>r.width>0).length,overflow:e.scrollWidth>e.clientWidth,identity:e.closest('.turn-row').firstElementChild.getBoundingClientRect().toJSON()};});
  assert.equal(geometry.labelLines,1);assert.equal(geometry.font,'15px');assert.equal(geometry.padding,'12px');assert(geometry.rect.height>=46);assert(!geometry.overflow);
  assert(geometry.rect.top>=geometry.identity.bottom || geometry.rect.left>=geometry.identity.right);
  assert.equal(await page.locator('.turn-actions .button').last().innerText(),'Event');
  results.push({width,turn,before,geometry});await shot('home-'+turn+'-'+width);
 }
 predictions=true;
 for(const width of [320,360,375,390,430,720,951,1440]) {
  classics=false;await page.setViewportSize({width,height:900});await page.goto(uiBase+'/#/home');await page.reload();await page.locator('.turn-predictions').waitFor();
  const positions=await page.locator('.turn-row').evaluate(e=>{const rect=s=>e.querySelector(s).getBoundingClientRect().toJSON();return {identity:rect(innerWidth<720?'.turn-identity .club-identity':'.turn-identity'),heading:rect('.turn-identity h2'),prediction:rect('.turn-predictions'),event:rect('.turn-actions > .button:last-child'),row:e.getBoundingClientRect().toJSON()};});
  assert(positions.prediction.x>=positions.identity.right-1);if(width>=720)assert(positions.event.x>=positions.prediction.right-1);else {assert(positions.prediction.top>=positions.heading.bottom);assert(positions.event.top>=positions.prediction.bottom);assert(await page.locator('.turn-predictions h3').evaluate(e=>e.scrollWidth<=e.clientWidth));}assert(Math.abs(positions.event.bottom-positions.row.bottom)<1);
  await shot('home-ai-'+width);
 }
 predictions=false;
 for(const width of [320,360,390,719,720,1440]){
  await page.setViewportSize({width,height:900});await page.goto(uiBase+'/#/home');await page.reload();await page.getByRole('button',{name:'Explain score abbreviations'}).first().click();
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  const table=await page.locator('.score-abbreviations').evaluate(e=>({width:e.getBoundingClientRect().width,scroll:e.parentElement.scrollWidth,client:e.parentElement.clientWidth,rows:[...e.rows].map(r=>[...r.cells].filter(c=>getComputedStyle(c).display!=='none').map(c=>({text:c.innerText,align:getComputedStyle(c).textAlign,width:c.getBoundingClientRect().width,overflow:c.scrollWidth>c.clientWidth})))}));
  assert(table.scroll<=table.client);assert(table.rows.every(r=>r.length===(width<720?2:4)));assert.deepEqual(table.rows[0].map(c=>c.text),width<720?['Abbreviation','Source']:['Abbreviation','Source','Native','Normalised']);
  for(const r of table.rows){assert.deepEqual(r.map(c=>c.align),width<720?['left','left']:['left','left','right','right']);assert(r.every(c=>!c.overflow));if(width>=720)assert(Math.abs(r[2].width-r[3].width)<1);}
  const rt=table.rows.filter(r=>r[1]?.text.startsWith('Rotten Tomatoes'));assert.deepEqual(rt.map(r=>r[1].text),width<720?['Rotten Tomatoes Audience','Rotten Tomatoes Critic']:['Rotten Tomatoes Audience Score','Rotten Tomatoes Critic Score']);
  results.push({width,table});await shot('glossary-'+width);await page.keyboard.press('Escape');
 }
 for(const width of [720,951,1440])for(const count of [0,1,9,99,100,126]){
  const pool=Array.from({length:count},(_,i)=>metricsFilm('missing-'+i,{classic:true}));catalog.movies=pool;catalog.sessions=[];
  await page.setViewportSize({width,height:900});await page.goto(uiBase+'/#/home');await page.reload();await page.locator('.turn-card').waitFor();
  await page.waitForFunction(count=>document.querySelector('.desktop-navigation a[href="#/seen"]')?.getAttribute('aria-label')===(count?`Seen: ${count} missing ${count===1?'answer':'answers'}`:'Seen'),count);
  for(const expanded of [true,false]){
   if(!expanded)await page.getByRole('button',{name:'Collapse navigation',exact:true}).click();
   const seen=page.locator('.desktop-navigation a[href="#/seen"]'),badge=seen.locator('.navigation-count');
   assert.equal(await page.locator('.desktop-navigation a[href="#/classics"] .navigation-count').count(),0);assert.equal(await page.locator('.bottom-nav .navigation-count').count(),0);
   assert.equal(await seen.getAttribute('aria-label'),count?`Seen: ${count} missing ${count===1?'answer':'answers'}`:'Seen');assert.equal(await badge.count(),count?1:0);
   if(count){assert.equal(await badge.innerText(),count>99?'99+':String(count));const b=await badge.boundingBox(),link=await seen.boundingBox();assert(b.x>=link.x&&b.x+b.width<=link.x+link.width);assert(b.y>=link.y&&b.y+b.height<=link.y+link.height);const icon=await seen.locator("img").boundingBox();assert(b.y+b.height<=icon.y || b.x>=icon.x+icon.width);}
   await page.keyboard.press('Tab');await seen.focus();assert(await seen.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'));await shot(`nav-${width}-${count}-${expanded}`);
  }
 }
 // Real data controller and mounted Cabinet; synthetic API functions use immutable snapshots.
 await context.route(/\/frontend\/main\.tsx(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import '/node_modules/@fontsource/lexend-deca/400.css';import '/node_modules/@fontsource/lexend-deca/600.css';import '/style.css';import '/frontend/app.css';
import {useBookClubData} from '/frontend/useBookClubData.ts';import {MetricsScreen} from '/frontend/MetricsScreen.tsx';import {api} from '/frontend/api.ts';
import {metricsFilm,metricsEvent,metricsFixture} from '/tests/metrics-fixture.ts';
const a=metricsFilm('film-a',{title:'Wrong canonical film',year:1900}),b=metricsFilm('film-b',{title:'Replacement canonical film',year:1890});
let source={...metricsFixture(),movies:[a,b],sessions:[metricsEvent('corrected',[a])]};
api.preferences=async()=>({show_ai:false});api.predictions=async()=>[];api.health=async()=>({authenticationRequired:false});api.me=async()=>({viewer:{id:'m1',avatar:1}});api.catalog=async()=>source;api.rotation=async()=>null;api.metricsEnrichment=async()=>({movies:{'film-a':{metadata:null,countries:[],languages:[],companies:[],credits:[],contentRatings:[],keywords:[]}}});
window.replaceFilm=async()=>{source={...source,sessions:[{...source.sessions[0],movies:[b]}]};const result=await window.data.readJournalMutation(async()=>({session:source.sessions[0]}));window.data.applyJournalMutation(result);};
function Harness(){const data=useBookClubData(false);window.data=data;return data.catalog?React.createElement('main',null,React.createElement(MetricsScreen,{catalog:data.catalog,viewer:data.viewer,onUpdated:data.refreshData,resource:data.metricsResource})):null;}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
`}));
 await page.setViewportSize({width:1440,height:900});await page.goto(uiBase+'/');await page.reload();await page.waitForFunction(()=>!!window.data);await page.evaluate(()=>window.data.load());await page.getByRole('tab',{name:'Records',exact:true}).click();
 const films=page.locator('.metrics-film-extreme');await films.first().waitFor();assert(await films.locator('a[href="#/movie/film-a"]').count()>0);await shot('cabinet-before');
 await page.evaluate(()=>window.replaceFilm());await page.waitForFunction(()=>!document.querySelector('.metrics-film-extreme a[href="#/movie/film-a"]'));
 assert(await films.locator('a[href="#/movie/film-b"]').count()>0);await shot('cabinet-after');
 await page.evaluate(()=>window.data.refreshData());await page.waitForFunction(()=>!!document.querySelector('.metrics-film-extreme a[href="#/movie/film-b"]'));assert.equal(await films.locator('a[href="#/movie/film-a"]').count(),0);
 assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log('Mobile corrections, desktop Seen badge and mounted Cabinet rendered checks passed.');
}catch(error){console.error({errors,body:await page.locator('body').innerText()});throw error;}finally{await browser.close();}

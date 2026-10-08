// Optional local-Vite visual check. Fictional data only; all APIs and external traffic are blocked.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const output='.verification/metrics-staging';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),errors=[],samples=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>{const url=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(url.hostname)?route.fallback():route.abort();});
await page.route('**/api/**',route=>{errors.push('Unmocked API request');return route.abort();});
await page.route('**/__dev/**',route=>route.abort());
await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:"export const api=globalThis.__auditApi ??= {};export class ApiClientError extends Error {}export const hasSession=()=>true;export const setUnauthorizedHandler=()=>{};export const setDevMember=()=>{};export const clearSession=()=>{};export const storeSession=()=>{};"}));
const source=await(await fetch('http://localhost:4173/frontend/main.tsx')).text(),reactUrl=source.match(/from "([^"\n]+\/react\.js[^"\n]*)"/)[1],domUrl=source.match(/from "([^"\n]+\/react-dom_client\.js[^"\n]*)"/)[1];
await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`
import React from '${reactUrl}';import ReactDOM from '${domUrl}';import '/style.css';import '/frontend/app.css';
import '/node_modules/@fontsource/lexend-deca/400.css';import '/node_modules/@fontsource/lexend-deca/500.css';import '/node_modules/@fontsource/lexend-deca/600.css';import '/node_modules/@fontsource/lexend-deca/700.css';
import {App} from '/frontend/App.tsx';import {metricsFixture,metricsFilm,metricsEvent,observation} from '/tests/metrics-fixture.ts';import {emptyEnrichmentMovie} from '/shared/metrics-enrichment.ts';import {api} from '/frontend/api.ts';
const catalog=metricsFixture(),data={movies:{}};catalog.members.forEach((m,i)=>m.avatar=i+1);
catalog.movies=Array.from({length:24},(_,i)=>metricsFilm('staging-'+i,{title:'Fictional film '+i+' with a long title for responsive verification',classic:true,year:1920+i*4,runtime:60+i*8,genres:['Drama','Comedy','Crime'],scores:[observation('metacritic','critic',60,100),observation('imdb','rating',8,10,100+i*100)],seen:catalog.members.map((m,j)=>({member_id:m.id,seen:(i+j)%2,updated_at:''})),au_watch_offers:[{service_id:'1',name:'Netflix',access_type:'subscription',link:null},{service_id:'2',name:'Apple TV Store',access_type:'rent',link:null}]}));
catalog.cycles=Array.from({length:8},(_,i)=>({id:'cycle-'+i,ordinal:i+1,rough_date:'2026-01-01',title:null,import_source:'synthetic',import_key:'cycle-'+i,created_at:'',updated_at:'',classics_first:i===1?1:0}));
catalog.sessions=catalog.cycles.flatMap(c=>Array.from({length:5},(_,i)=>({...metricsEvent(c.id+'-'+i,[catalog.movies[(c.ordinal*2+i)%24],catalog.movies[(c.ordinal*2+i+1)%24]],i+1===(c.classics_first?1:5)?null:'m'+(i===4?1:i+1)),cycle_id:c.id,cycle_slot:i+1})));
for(const [i,movie] of catalog.movies.entries())data.movies[movie.id]={...emptyEnrichmentMovie(),metadata:{original_language:'en',budget:1000000*(i+1),revenue:10000000*(i+1)},keywords:[{provider:'tmdb',name:'time-travel'},{provider:'tmdb',name:'friendship'}],contentRatings:[{certification:['G','PG','M','MA15+','R18+'][i%5],release_type:3}],credits:[...Array.from({length:23},(_,j)=>({kind:'cast',role:'cast',person_id:String(j+1),name:'Fictional actor '+j+' with a long credited name'})),...['writer','screenplay','composer','cinematographer'].map(role=>({kind:'crew',role,person_id:role==='screenplay'?'writer':role,name:'Fictional '+(role==='screenplay'?'writer':role)}))],collection:{status:i%3?'checked_present':'checked_none',external_id:String(i+1),checked_at:'2026',collection_id:i%3?1:null,collection_name:i%3?'Fictional collection':null},awards:{status:'checked_quantified',external_id:'tt'+i,checked_at:'2026',wins:i,nominations:i+2,awards_text:i+' wins & '+(i+2)+' nominations.'}};
window.enrichmentReads=0;api.health=async()=>({status:'ok',environment:'test',authenticationRequired:true,demo:false});api.me=async()=>({viewer:{...catalog.members[0],role:'member'}});api.catalog=async()=>catalog;api.rotation=async()=>({id:1,nominal_slot:1,cycle_id:null,version:0,updated_at:''});api.builders=async()=>[];api.metricsEnrichment=async()=>{window.enrichmentReads++;return data;};
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
`}));
try {
 for(const width of [320,390,720,951,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('http://localhost:4173/#/metrics');await page.getByRole('tab',{name:'Staging',exact:true}).click();await page.locator('.staging-report').last().waitFor();await page.locator('.metrics-filters button').first().click();
  assert.equal(await page.locator('.staging-report').count(),17);assert.equal(await page.locator('.staging-cycle').count(),8);assert.equal(await page.locator('.staging-matrix td[aria-label]').count(),50);
  const stars=page.locator('[aria-label="Shared stars"]');assert.equal(await stars.locator('.staging-data-row').count(),20);await stars.getByRole('button',{name:'Next',exact:true}).click();assert.equal(await stars.locator('.staging-data-row').count(),3);await stars.getByRole('button',{name:'Previous',exact:true}).click();
  const cycle=await page.locator('.staging-cycles').evaluate(e=>({height:e.clientHeight,total:e.scrollHeight,firstFive:[...e.children].slice(0,5).reduce((n,c)=>n+c.getBoundingClientRect().height,0)}));assert(cycle.total>cycle.height);assert(Math.abs(cycle.height-cycle.firstFive)<2);
  await page.locator('.staging-cycles').evaluate(e=>e.scrollTop=e.scrollHeight);assert(await page.locator('.staging-cycle').last().isVisible());
  const axes=await page.locator('[aria-label^="Shared"]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
  const matrices=await page.locator('.staging-matrix-scroll').evaluateAll(es=>es.map(e=>({width:e.clientWidth,total:e.scrollWidth})));if(width<720)assert(matrices.every(m=>m.total>m.width));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.evaluate(()=>window.enrichmentReads),1);
  await page.screenshot({path:output+'/staging-'+width+'.png',fullPage:true});await page.locator('.staging-cycles').evaluate(e=>e.scrollTop=0);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:output+'/top-'+width+'.png'});await page.locator('.staging-matrix-scroll').first().screenshot({path:output+'/matrix-'+width+'.png'});
  await page.locator('.metrics-filters button').nth(1).click();assert.deepEqual(await page.locator('[aria-label^="Shared"]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),axes);assert.equal(await page.locator('.staging-chart-row').count(),3);assert.equal(await page.locator('.staging-matrix td[aria-label]').count(),50);
  await page.getByRole('tab',{name:'Records',exact:true}).click();assert.equal(await page.locator('.metrics-film-extreme').count(),10);assert.equal(await page.locator('.metrics-reception-record').count(),2);assert.equal(await page.locator('.metrics-viewed-record').count(),2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:output+'/records-'+width+'.png',fullPage:true});
  samples.push({width,cycle,matrices,axes});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(output+'/measurements.json',JSON.stringify({samples,errors},null,2));console.log('Metrics Staging and Records: 17 reports, five-cycle window with older cycles, stable axes, accessible contained matrices, cached reads and no overflow passed at 320/390/720/951/1440px.');
} finally {await browser.close();}

// Synthetic Admin workflow. Every API/provider request is intercepted or blocked.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const output='.verification/unified-admin';fs.mkdirSync(output,{recursive:true});
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
import {App} from '/frontend/App.tsx';import {metricsFixture} from '/tests/metrics-fixture.ts';import {api} from '/frontend/api.ts';
const catalog=metricsFixture();catalog.members.forEach((m,i)=>m.avatar=i+1);catalog.movies=Array.from({length:24},(_,i)=>({...catalog.movies[0],id:'film-'+i,title:'Film '+i,classic:true,scores:[],external_ids:[{provider:'tmdb',external_id:String(i+1)},{provider:'imdb',external_id:'tt'+String(i+1).padStart(7,'0')}],tmdb_metadata_checked_at:null,tmdb_artwork_checked_at:null}));catalog.sessions=[];
api.health=async()=>({status:'ok',environment:'test',authenticationRequired:true,demo:false});api.me=async()=>({viewer:{...catalog.members[0],role:'admin'}});api.catalog=async()=>catalog;api.rotation=async()=>({id:1,nominal_slot:1,cycle_id:null,version:0,updated_at:''});api.builders=async()=>[];
api.maintenanceCoverage=async()=>({checks:[],negativeScores:[],enrichment:[],evidence:[],evidenceSupported:true,unavailable:{tmdb:null,omdb:null,mdblist:null},next:null});
window.calls=[];api.maintenanceProvider=async(intent,units)=>new Promise(resolve=>{window.calls.push({intent,units});window.finishBatch=(failed=false)=>{window.finishBatch=null;resolve({results:units.map((u,i)=>({movieId:u.movieId,provider:u.provider,status:failed&&i===1?'failed':'updated',message:failed&&i===1?'Synthetic provider failure':'Saved',...(failed&&i===1?{retryAfter:60}:{})})),canonicalChanged:true,cacheChanged:true,requests:units[0].provider==='mdblist'?1:units.length,stopped:failed});};});
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
`}));
try {
 for(const width of [320,390,720,1440]) {
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/admin');await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.getByRole('heading',{name:'Swap current turn',exact:true}).waitFor();await page.getByRole('button',{name:'Populate missing data',exact:true}).waitFor();
  assert.equal(await page.locator('main section.card').count(),17);assert.equal(await page.evaluate(()=>window.calls.length),0);
  const headings=await page.locator('main section.card h2,main section.card h3').allTextContents();assert.equal(headings[0],'Swap current turn');assert.equal(headings[1],'Populate missing data');assert.equal(headings[9],'Refresh all data');
  for(const title of ['Populate missing data','Refresh all data']) {
   await page.getByRole('button',{name:title,exact:true}).click();await page.getByRole('dialog').waitFor();assert((await page.getByRole('dialog').innerText()).includes('Estimated API requests:'));assert.equal(await page.evaluate(()=>window.calls.length),0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  const bounds=await page.locator('main .card button').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent,width:r.width,height:r.height,left:r.left,right:r.right};}));
  for(const b of bounds){assert(b.height>=44,b.label+' touch target');assert(b.left>=0&&b.right<=width,b.label+' containment');}
  const borders=await page.locator('main section.card').evaluateAll(es=>es.map(e=>({width:getComputedStyle(e).borderTopWidth,color:getComputedStyle(e).borderTopColor})));for(const border of borders){assert.equal(border.width,'1px');assert.notEqual(border.color,'rgba(0, 0, 0, 0)');}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:output+'/admin-'+width+'.png',fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:output+'/admin-top-'+width+'.png'});
  await page.getByRole('button',{name:'Refresh all data',exact:true}).click();await page.getByRole('button',{name:'Start maintenance',exact:true}).click();await page.waitForFunction(()=>typeof window.finishBatch==='function');
  assert(await page.getByRole('button',{name:'Refresh TMDB enrichment',exact:true}).isDisabled());await page.getByRole('button',{name:'Stop after this batch',exact:true}).click();await page.evaluate(()=>window.finishBatch(false));await page.getByRole('button',{name:'Stop after this batch',exact:true}).waitFor({state:'hidden'});
  const progress=page.locator('#refresh-all-heading').locator('xpath=..').locator('progress');assert.equal(await progress.getAttribute('data-state'),'normal');
  const normal=await progress.evaluate(e=>({value:e.value,max:e.max,accent:getComputedStyle(e).accentColor}));assert(normal.value>0&&normal.value<normal.max);
  const completed=await page.evaluate(()=>window.calls[0].units.map(u=>u.movieId+':'+u.provider));
  await page.reload();await page.getByRole('button',{name:'Resume Refresh all data',exact:true}).waitFor();await page.getByRole('button',{name:'Resume Refresh all data',exact:true}).click();await page.getByRole('button',{name:'Start maintenance',exact:true}).click();await page.waitForFunction(()=>typeof window.finishBatch==='function');
  assert.equal(await page.evaluate(completed=>window.calls[0].units.some(u=>completed.includes(u.movieId+':'+u.provider)),completed),false,'Resume avoids completed provider units');
  await page.evaluate(()=>window.finishBatch(true));await page.getByRole('button',{name:'Stop after this batch',exact:true}).waitFor({state:'hidden'});assert.equal(await progress.getAttribute('data-state'),'interrupted');const interrupted=await progress.evaluate(e=>({value:e.value,max:e.max,accent:getComputedStyle(e).accentColor}));assert.notEqual(interrupted.accent,normal.accent);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:output+'/interrupted-'+width+'.png',fullPage:true});samples.push({width,headings,bounds,borders,normal,interrupted});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(output+'/measurements.json',JSON.stringify({samples,errors},null,2));console.log('Unified Admin: order, confirmations, lock, Stop/resume, normal/ruby progress and no overflow passed at 320/390/720/1440px.');
} finally {await browser.close();}

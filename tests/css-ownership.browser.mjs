// Synthetic App presentation checks; Vite and optional Playwright, no API/DB/provider.
// Pass --baseline <CSS path> to compare every computed property and element bounds.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
async function applicationCss(path='frontend/app.css') {
 const source=await fs.readFile(path,'utf8'),imports=[...source.matchAll(/@import\s+['"]([^'"]+)['"];?/g)];
 const contents=await Promise.all(imports.map(match=>applicationCss(resolve(dirname(path),match[1]))));
 return imports.reduce((css,match,i)=>css.replace(match[0],contents[i]),source);
}
const currentCss=await applicationCss();
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const baselineIndex=process.argv.indexOf('--baseline');
const baseline=baselineIndex<0?null:await fs.readFile(process.argv[baselineIndex+1],'utf8');
const source=await (await fetch('http://localhost:4173/frontend/main.tsx')).text();
const reactUrl=source.match(/from "([^"]+\/react\.js[^"]*)"/)[1];
const domUrl=source.match(/from "([^"]+\/react-dom_client\.js[^"]*)"/)[1];
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const evidence=[];
try {
 const page=await browser.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.fallback():r.abort());
 await page.route('**/api/v1/**',r=>r.abort());
 await page.route('**/__dev/**',r=>r.abort());
 await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`export const api=globalThis.__reviewApi ??= {};export class ApiClientError extends Error {} export const hasSession=()=>true;export const setUnauthorizedHandler=()=>{};export const setDevMember=()=>{};export const clearSession=()=>{};export const storeSession=()=>{};`}));
 await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
 import React from '${reactUrl}';import ReactDOM from '${domUrl}';
 import '/node_modules/@fontsource/lexend-deca/300.css';import '/node_modules/@fontsource/lexend-deca/400.css';import '/node_modules/@fontsource/lexend-deca/600.css';
 import '/style.css';import '/frontend/app.css';import {App} from '/frontend/App.tsx';import {api} from '/frontend/api.ts';import {rankMovie} from '/shared/ranking.ts';
 const members=[1,2,3,4].map(i=>({id:'m'+i,display_name:'Member '+i,active:1,sort_order:i,avatar:i}));
 const movies=Array.from({length:9},(_,i)=>{const scores=[['imdb','rating',80],['rottentomatoes','audience',90],['rottentomatoes','critic',85]].map(([provider,metric,value])=>({provider,metric,raw_value:value,raw_scale:100,normalized_value:value,vote_count:100,fetched_at:'2026-01-01'}));const seen=i===8?[]:members.map(m=>({member_id:m.id,seen:0,updated_at:''}));return {id:'f'+i,title:i===0?'A very long synthetic film title wrapping at mobile widths':'Film '+i,year:2000+i,director:'Synthetic Director',runtime:101,overview:'A synthetic overview with long text. '.repeat(8),original_title:null,release_date:null,genres:['Drama'],assets:[],external_ids:[{provider:'tmdb',external_id:String(100+i)},{provider:'imdb',external_id:'tt000000'+i}],scores,seen,classic:true,ranking:rankMovie(scores,seen,members),appearances:[]};});
 const cycles=[{id:'c1',ordinal:1,rough_date:'2026-01-01',created_at:'',updated_at:'',title:null}];
 const sessions=[{id:'e1',event_date:'2026-01-01',date_precision:'exact',cycle_id:'c1',cycle_slot:1,kind:'hosted',host_member_id:'m1',legacy_cycle_label:null,movies:[movies[0],movies[1]],revision:1,has_audit:true}];
 const catalog={movies,members,cycles,sessions};
 const set={id:'set',owner_member_id:'m2',title:'Synthetic private set',notes:null,movie_ids:['f0','f1','f2','f3'],revision:1,created_at:'2026-01-01',updated_at:''};
 api.preferences=async()=>({show_ai:false});api.predictions=async()=>[];api.maintenanceJobs=async()=>({jobs:[]});api.health=async()=>({status:'ok',environment:'test',authenticationRequired:true,googleAuthConfigured:false,demo:false});api.me=async()=>({viewer:{...members[1],role:'admin'}});
 api.catalog=async()=>catalog;api.rotation=async()=>({id:1,nominal_slot:2,cycle_id:'c1',version:0,updated_at:'',human_order:{}});
 api.builders=async()=>[set];api.saveBuilder=async body=>({...set,...body});api.detail=async id=>({...movies.find(m=>m.id===id),appearances:[]});
 api.search=async()=>({local:movies.map(m=>({id:m.id,title:m.title,year:m.year,tmdbId:null,poster:null})),external:[{provider:'tmdb',externalId:'42',title:'External preview',year:2001,poster:null}],lookup:{available:true,message:null}});
 api.preview=async()=>({provider:'tmdb',externalId:'42',title:'External preview',original_title:null,year:2001,release_date:null,runtime:110,overview:'Preview only',genres:['Drama'],assets:[],director:'Director'});
 api.metricsEnrichment=async()=>({movies:{}});api.scoreMaintenanceStatus=async()=>({candidateIds:movies.map(m=>m.id),eligibleDimensions:54,unavailableDimensions:0,unavailableFilms:0});api.audit=async()=>[];
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
 `}));
 const check=async label=>{
  await page.evaluate(async()=>{await document.fonts.ready;});
  await page.waitForTimeout(100);
  // Time-dependent animation values are irrelevant to a stylesheet move.
  await page.addStyleTag({content:'*,*::before,*::after { animation: none !important; transition: none !important; }'});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.body.getBoundingClientRect();resolve();}))));
  // Compare both expanded sources in the same stylesheet slot and warm their
  // computed styles before recording: Chromium can retain first-layout auto
  // margins until a complete style read, even when comparing identical CSS.
  await page.evaluate(css=>{
   for(const style of document.querySelectorAll('style[data-vite-dev-id]'))if(style.dataset.viteDevId.includes('/frontend/app.css')||style.dataset.viteDevId.includes('/frontend/styles/'))style.sheet.disabled=true;
   let style=document.getElementById('css-review-application');if(!style){style=document.createElement('style');style.id='css-review-application';document.head.appendChild(style);}style.textContent=css;
  },currentCss);
  await settle();
  const snapshot=phase=>page.evaluate(phase=>{
   const data=[...document.querySelectorAll('body *')].filter(e=>!['SCRIPT','STYLE'].includes(e.tagName)).map(e=>{
    const rect=e.getBoundingClientRect();const properties=style=>Object.fromEntries([...style].map(p=>[p,style.getPropertyValue(p)]));
    return {tag:e.tagName,class:e.getAttribute('class'),bounds:[rect.x,rect.y,rect.width,rect.height],style:properties(getComputedStyle(e)),before:properties(getComputedStyle(e,'::before')),after:properties(getComputedStyle(e,'::after'))};
   });
   if(phase==='warm')return {elements:data.length,differences:[]};
   if(phase==='current'){globalThis.__cssOwnershipSnapshot=data;return {elements:data.length,differences:[]};}
   const current=globalThis.__cssOwnershipSnapshot,original=data,differences=[];
   if(current.length!==original.length)differences.push(['element count',current.length,original.length]);
   for(let i=0;i<Math.min(current.length,original.length);i++)for(const field of ['bounds','style','before','after']){
    if(field==='bounds'){if(JSON.stringify(current[i][field])!==JSON.stringify(original[i][field]))differences.push([i,current[i].class,field,current[i][field],original[i][field]]);}
    else for(const key of new Set([...Object.keys(current[i][field]),...Object.keys(original[i][field])]))if(current[i][field][key]!==original[i][field][key])differences.push([i,current[i].class,field,key,current[i][field][key],original[i][field][key]]);
   }
   delete globalThis.__cssOwnershipSnapshot;
   return {elements:data.length,differences};
  },phase);
  await snapshot('warm');await settle();
  const current=await snapshot('current');
  if(baseline){
   await page.evaluate(css=>{document.getElementById('css-review-application').textContent=css;},baseline);
   await settle();
   await snapshot('warm');await settle();
   const {differences}=await snapshot('baseline');
   await page.evaluate(css=>{document.getElementById('css-review-application').textContent=css;},currentCss);
   await settle();
   if(differences.length){await fs.mkdir('.verification/css-ownership',{recursive:true});await fs.writeFile('.verification/css-ownership/differences.json',JSON.stringify({label,differences},null,2));}
   assert.equal(differences.length,0,label+': '+JSON.stringify(differences.slice(0,3)));
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' overflow');
  console.log(label+' passed');
  evidence.push({label,elements:current.elements,baselineCompared:Boolean(baseline)});
 };
 for(const width of [320,390,720,1440]){
  await page.setViewportSize({width,height:900});
  for(const route of ['home','history','builder','event','classics','seen','metrics','admin','movie/f0']){
   await page.goto('http://localhost:4173/?css-review='+encodeURIComponent(width+'-'+route)+'#/'+route,{waitUntil:'domcontentloaded'});await page.locator('main .card, main .stack, main .metrics-content').first().waitFor();await page.locator('main .loading-placeholder').waitFor({state:'hidden'});
   await check(width+' '+route);
   if(route==='home'&&width>=720){await page.getByRole('button',{name:'Collapse navigation'}).click();await check(width+' collapsed navigation');}
   if(route==='builder'){await page.getByRole('button',{name:'Open set',exact:true}).click();await check(width+' Builder editor');await page.getByRole('button',{name:'Use set',exact:true}).click();await page.getByRole('heading',{name:'Use Synthetic private set?'}).waitFor();await check(width+' Builder confirmation');}
   if(route==='classics'){await page.getByRole('button',{name:'Add Classic',exact:true}).click();await page.locator('dialog[open]').waitFor();await check(width+' Add Classic dialog');}
   if(route==='event'){await page.getByRole('textbox',{name:'Search films'}).fill('film');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.locator('.search-row a[href="#/preview/tmdb/42"]').click();await page.getByRole('button',{name:'Yes, this one!',exact:true}).waitFor();await check(width+' Preview and inspection');}
   if(route==='metrics'){for(const tab of await page.getByRole('tab').all()){await tab.click();await check(width+' Metrics '+await tab.textContent());}}
  }
 }
 assert.deepEqual(errors,[]);
 await fs.mkdir('.verification/css-ownership',{recursive:true});await fs.writeFile('.verification/css-ownership/results.json',JSON.stringify(evidence,null,2));
 console.log(`CSS presentation passed: ${evidence.length} populated states${baseline?' with identical computed styles and bounds':''}.`);
}finally{await browser.close();}

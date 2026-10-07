// Synthetic local App review: all APIs mocked, all external requests blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const source=await (await fetch('http://localhost:4173/frontend/main.tsx')).text();
const reactUrl=source.match(/from "([^"\n]+\/react\.js[^"\n]*)"/)[1];
const domUrl=source.match(/from "([^"\n]+\/react-dom_client\.js[^"\n]*)"/)[1];
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.fallback():r.abort());
 await page.route('**/api/v1/**',r=>r.abort());
 await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`export const api=globalThis.__reviewApi ??= {};export class ApiClientError extends Error {} export const hasSession=()=>true;export const setUnauthorizedHandler=()=>{};export const setDevMember=()=>{};export const clearSession=()=>{};export const storeSession=()=>{};`}));
 await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
 import React from '${reactUrl}';import ReactDOM from '${domUrl}';import '/node_modules/@fontsource/lexend-deca/300.css';import '/node_modules/@fontsource/lexend-deca/400.css';import '/node_modules/@fontsource/lexend-deca/600.css';import '/style.css';import '/frontend/app.css';
 import {App} from '/frontend/App.tsx';import {api} from '/frontend/api.ts';import {rankMovie} from '/shared/ranking.ts';
 const members=[{id:'owner',display_name:'Troy',active:1,sort_order:2,avatar:2},{id:'sean',display_name:'Sean',active:1,sort_order:1,avatar:1}];
 const movies=Array.from({length:9},(_,i)=>({id:'m'+i,title:i===0?'A very long film title that must wrap while lineup controls remain usable':'Film '+i,year:1994,runtime:105,au_classification:i===0?'MA15+':undefined,director:'A Director',overview:'Synthetic plot.',original_title:null,release_date:null,genres:[],assets:[],external_ids:[],scores:[{provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:30,fetched_at:'2026'}],seen:members.map(m=>({member_id:m.id,seen:0,updated_at:''})),classic:true,ranking:null,appearances:[]}));movies.forEach(m=>m.ranking=rankMovie(m.scores,m.seen,members));
 const cycles=Array.from({length:12},(_,i)=>({id:'c'+(12-i),ordinal:12-i,rough_date:'2026-01-01',title:null}));
 const sessions=cycles.flatMap(c=>[1,2].map(slot=>({id:c.id+'-'+slot,event_date:'2026-01-01',host_member_id:'owner',cycle_id:c.id,cycle_slot:slot,kind:'hosted',date_precision:'cycle_rough',legacy_cycle_label:null,movies:movies.slice(0,2)})));
 let sets=[1,2,3,9].map(n=>({id:'s'+n,owner_member_id:'owner',title:n+' film set',notes:'Private notes',movie_ids:movies.slice(0,n).map(m=>m.id),revision:1,created_at:'2026-01-01',updated_at:''}));
 api.health=async()=>({status:'ok',environment:'local',authenticationRequired:false,demo:false});api.me=async()=>({viewer:{...members[0],role:'member'}});api.catalog=async()=>({movies,members,cycles,sessions});api.rotation=async()=>({id:1,nominal_slot:2,cycle_id:'c12',version:0,updated_at:''});api.builders=async()=>sets;
 api.saveBuilder=async(body,id)=>{await new Promise(r=>setTimeout(r,30));const saved={...body,id:id||'new',owner_member_id:'owner',revision:(body.revision||0)+1,created_at:'2026-01-01',updated_at:''};sets=[...sets.filter(s=>s.id!==saved.id),saved];return saved;};
 api.search=async()=>({local:movies.map(m=>({id:m.id,title:m.title,year:m.year,tmdbId:null,poster:null})),external:[],lookup:{available:true,message:null}});api.detail=async id=>movies.find(m=>m.id===id);
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
 `}));
 await fs.mkdir('.verification/home-history-builder',{recursive:true});
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const shot=async(width,name)=>{await overflow();await page.screenshot({path:'.verification/home-history-builder/'+width+'-'+name+'.png',fullPage:true});};
 for(const width of [320,390,720,1440]) {
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/home');await page.reload();await page.getByRole('heading',{name:'Classics Snapshot',exact:true}).waitFor({timeout:10000}).catch(async e=>{console.log(errors,await page.locator('body').innerText());throw e;});
  assert.deepEqual(await page.locator('.home-dashboard .section-title h2').allTextContents(),['Last turn','Next Classics','Classics Snapshot']);
  const borders=await page.locator('.home-dashboard .turn-card,.home-session-card,.home-rank-card').evaluateAll(nodes=>nodes.map(e=>getComputedStyle(e).borderColor));assert(borders.every(c=>c===borders[0]));await shot(width,'home');
  await page.getByRole('link',{name:'History',exact:true}).first().click();await page.getByRole('button',{name:'Resort History oldest first'}).click();assert.equal(await page.locator('section[id^="cycle-"]').first().getAttribute('id'),'cycle-c1');assert.equal(await page.locator('#cycle-c1 .movie-title').first().textContent(),'Film 1');
  assert.equal(await page.locator('.history-film-director').first().textContent(),'A Director');assert((await page.locator('#cycle-c1').textContent()).includes('1994 · 105 min · MA15+'));await shot(width,'history');
  await page.getByLabel('Jump to cycle').selectOption('c11');assert.equal(await page.locator('section[id^="cycle-"]').first().getAttribute('id'),'cycle-c11');await page.locator('.film-list .movie-link').first().click();await page.goBack();await page.getByRole('button',{name:'Resort History newest first'}).waitFor();
  await page.getByRole('link',{name:'Builder',exact:true}).click();await page.getByRole('button',{name:'Open set'}).first().waitFor();assert.deepEqual(await page.locator('.builder-poster-strip').evaluateAll(nodes=>nodes.map(n=>n.children.length)),[1,2,3,4]);
  const buttonRect=await page.getByRole('button',{name:'New set'}).boundingBox();const headingRect=await page.locator('.page-heading').boundingBox();assert(buttonRect.width<headingRect.width);await shot(width,'builder-list');
  const posterGeometry=await page.locator('.builder-poster-strip').first().evaluate(e=>{const parent=e.getBoundingClientRect(),poster=e.firstElementChild.getBoundingClientRect();return Math.abs((parent.left+parent.right)/2-(poster.left+poster.right)/2);});assert(posterGeometry<1);
  await page.getByRole('button',{name:'New set'}).click();await page.getByLabel('Private title (optional)').waitFor();assert.equal(await page.getByText('Add a film manually',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'New set'}).count(),0);
  await page.getByLabel('Private title (optional)').fill('Autosaved draft');await page.getByLabel('Search saved films & TMDB').fill('film');await page.getByRole('button',{name:'Search',exact:true}).click();
  const colours=await page.locator('.builder-result-add').first().evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));assert.deepEqual(colours,{background:'rgb(66, 203, 111)',color:'rgb(0, 0, 0)'});
  await page.locator('.builder-result-add').first().click();await page.getByLabel('Search saved films & TMDB').fill('film');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Add Film 1',exact:true}).click();
  assert.deepEqual(await page.locator('.builder-lineup .position').allTextContents(),['#1','#2']);assert.equal(await page.getByRole('button',{name:'Move Film 1 later',exact:true}).isDisabled(),true);await shot(width,'builder-editor');
  const rows=await page.locator('.builder-lineup li').evaluateAll(nodes=>nodes.map(li=>{const info=li.firstElementChild.getBoundingClientRect(),actions=li.lastElementChild.getBoundingClientRect();return info.right<=actions.left;}));assert(rows.every(Boolean));
  await page.getByRole('button',{name:'Move Film 1 earlier',exact:true}).click();assert.equal(await page.locator('.builder-lineup .movie-title').first().textContent(),'Film 1');await page.getByRole('button',{name:'Remove Film 1',exact:true}).click();
  await page.getByRole('button',{name:'Save set',exact:true}).click();await page.getByRole('heading',{name:'Autosaved draft',exact:true}).waitFor();await shot(width,'builder-saved');results.push({width,passed:true});
 }
 assert.deepEqual(errors,[]);await fs.writeFile('.verification/home-history-builder/results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));
} finally {await browser.close();}

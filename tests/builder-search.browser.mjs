// Synthetic Builder/App responsive checks. Requires Vite and optional Playwright; no live API/provider access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const source=await (await fetch('http://localhost:4173/frontend/main.tsx')).text();
const reactUrl=source.match(/from "([^"]+\/react\.js[^"]*)"/)[1];
const domUrl=source.match(/from "([^"]+\/react-dom_client\.js[^"]*)"/)[1];
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.fallback():r.abort());
 await page.route('**/api/v1/**',r=>r.abort());
 await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`export const api=globalThis.__reviewApi ??= {};export class ApiClientError extends Error {} export const hasSession=()=>true;export const setUnauthorizedHandler=()=>{};export const setDevMember=()=>{};export const clearSession=()=>{};export const storeSession=()=>{};`}));
 await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/,r=>r.fulfill({contentType:'text/javascript',body:`
 import React from '${reactUrl}';import ReactDOM from '${domUrl}';
 import '/node_modules/@fontsource/lexend-deca/300.css';import '/node_modules/@fontsource/lexend-deca/400.css';import '/node_modules/@fontsource/lexend-deca/600.css';
 import '/style.css';import '/frontend/app.css';import {App} from '/frontend/App.tsx';import {api} from '/frontend/api.ts';
 const members=[{id:'viewer',display_name:'Troy',active:1,sort_order:2,avatar:2},{id:'sean',display_name:'Sean',active:1,sort_order:1,avatar:1}];
 const movies=Array.from({length:8},(_,i)=>({id:'m'+i,title:i===0?'A very long film title with enough words to wrap naturally on narrow mobile screens':'Film '+i,year:1999,director:i===1?'Jane Smith':null,runtime:110,overview:'A synthetic film overview. '.repeat(8),original_title:null,release_date:null,genres:[],assets:[],external_ids:[],scores:[],seen:[],classic:false,ranking:null,appearances:[]}));
 let sets=[];api.health=async()=>({status:'ok',environment:'local',authenticationRequired:false,demo:false});api.me=async()=>({viewer:{...members[0],role:'member'}});
 api.catalog=async()=>({movies,members,sessions:[],cycles:[]});api.rotation=async()=>({id:1,nominal_slot:2,cycle_id:null,version:0,updated_at:'',human_order:location.search.includes('other-turn')?{'2':'sean'}:{}});
 api.builders=async()=>sets;api.saveBuilder=async(body,id)=>{const saved={...body,id:id||'set',owner_member_id:'viewer',revision:1,created_at:'2026-01-01',updated_at:''};sets=[saved];return saved;};
 api.search=async()=>({local:movies.map(m=>({id:m.id,title:m.title,year:m.year,tmdbId:null,poster:null})),external:[],lookup:{available:true,message:null}});api.detail=async id=>movies.find(m=>m.id===id);
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
 `}));
 await fs.mkdir('.verification/builder-search',{recursive:true});
 const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 const search=async()=>{await page.getByRole('textbox',{name:'Search films'}).fill('film');await page.getByRole('button',{name:'Search',exact:true}).click();await page.locator('.search-row').first().waitFor();};
 for(const width of [320,390,720,951,1440]) {
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/builder');await page.reload();await page.getByRole('button',{name:'New set'}).click();
  await page.getByRole('textbox',{name:'Private title (optional)'}).fill('A saved set with a longer title');assert.equal(await page.getByRole('textbox',{name:'Private note (optional)'}).count(),0);
  assert.deepEqual(await page.locator('.builder-editor-actions button').allTextContents(),['All sets','Use set','Save set']);
  const dock=await page.locator('.builder-editor-actions').evaluate(e=>{const row=e.getBoundingClientRect(),buttons=[...e.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return buttons[0].left>=row.left && Math.abs(buttons[2].right-row.right)<1 && buttons.every(b=>Math.abs(b.top-buttons[0].top)<1) && buttons[0].right<=buttons[1].left && buttons[1].right<=buttons[2].left;});assert(dock);
  await search();assert.equal(await page.locator('.search-row .meta').first().textContent(),'1999 · 110 min');assert.equal(await page.locator('.search-row .film-director').first().textContent(),'Jane Smith');
  assert.equal(await overflow(),false);await page.screenshot({path:'.verification/builder-search/'+width+'-editor.png',fullPage:true});
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.locator('.search-row a').first().click();await page.getByRole('button',{name:'Add to set',exact:true}).waitFor();
  const geometry=await page.locator('.page-heading').evaluate(e=>{const title=e.querySelector('h1').getBoundingClientRect(),action=e.querySelector('button').getBoundingClientRect();return {titleRight:title.right,titleTop:title.top,titleBottom:title.bottom,actionLeft:action.left,actionTop:action.top,actionBottom:action.bottom,actionWidth:action.width,actionRight:action.right,headingRight:e.getBoundingClientRect().right,headingWidth:e.getBoundingClientRect().width};});
  if(geometry.actionTop<geometry.titleBottom){assert(geometry.actionLeft>=geometry.titleRight);assert(geometry.actionBottom>geometry.titleTop);}else{assert(Math.abs(geometry.actionRight-geometry.headingRight)<1);}assert(geometry.actionWidth<geometry.headingWidth);assert.equal(await overflow(),false);
  await page.screenshot({path:'.verification/builder-search/'+width+'-detail.png',fullPage:true});
  await page.goBack();await page.getByRole('button',{name:'Save set',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Search films'}).inputValue(),'film');assert.match(await page.locator('.search-pagination').textContent(),/Page 2 of 2/);
  await page.locator('.search-row a').first().click();await page.getByRole('button',{name:'Add to set',exact:true}).click();await page.getByRole('button',{name:'Save set',exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Search films'}).inputValue(),'');assert.equal(await page.locator('.search-row').count(),0);
  assert.equal(await page.getByRole('textbox',{name:'Search films'}).evaluate(e=>e===document.activeElement),true);
  assert.equal(await page.getByRole('textbox',{name:'Private note (optional)'}).count(),0);
  await search();await page.getByRole('button',{name:'Add Film 1',exact:true}).click();await page.getByRole('button',{name:'Move Film 1 earlier',exact:true}).click();assert.deepEqual(await page.locator('.lineup-list .movie-title').allTextContents(),['Film 1','Film 6']);assert.equal(await overflow(),false);
  await page.screenshot({path:'.verification/builder-search/'+width+'-lineup.png',fullPage:true});await page.getByRole('button',{name:'Remove Film 1',exact:true}).click();
  await page.getByRole('button',{name:'Save set',exact:true}).click();await page.getByRole('button',{name:'Open set',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save set',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Open set',exact:true}).locator('.lucide-film').count(),1);
  await page.getByRole('button',{name:'Open set',exact:true}).click();await page.getByRole('button',{name:'Use set',exact:true}).click();await page.getByRole('heading',{name:'Use A saved set with a longer title?'}).waitFor();
  assert.equal(await page.locator('.builder-turn-warning').count(),0);assert.equal(await page.getByRole('button',{name:'Use set',exact:true}).isDisabled(),false);
  await page.screenshot({path:'.verification/builder-search/'+width+'-use-set.png',fullPage:true});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));assert.equal(await overflow(),false);
  await page.goto('http://localhost:4173/#/event');await search();assert.equal(await page.locator('.search-row .meta').first().textContent(),'1999 · 110 min');assert.equal(await overflow(),false);
  await page.locator('.search-row a').first().click();await page.getByRole('button',{name:'Yes, this one!',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Add to set',exact:true}).count(),0);await page.getByRole('button',{name:'Yes, this one!',exact:true}).click();await page.getByRole('button',{name:'Save event',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Search films'}).evaluate(e=>e===document.activeElement),true);
  await page.goto('http://localhost:4173/#/classics');await page.getByRole('button',{name:'Add Classic',exact:true}).click();await search();assert.equal(await page.locator('.search-row .meta').first().textContent(),'1999 · 110 min');assert.equal(await page.locator('.search-row .film-director').first().textContent(),'Jane Smith');assert.equal(await overflow(),false);
  await page.screenshot({path:'.verification/builder-search/'+width+'-classic-search.png',fullPage:true});
  await page.goto('http://localhost:4173/?other-turn=1#/builder');await page.getByRole('button',{name:'New set'}).click();await search();await page.locator('.builder-result-add').first().click();assert.equal(await page.getByRole('button',{name:'Use set',exact:true}).isDisabled(),true);await page.screenshot({path:'.verification/builder-search/'+width+'-other-turn.png',fullPage:true});
  console.log(width+'px Builder/detail/Use set/Event/Add Classic passed');
 }
 assert.deepEqual(errors,[]);
} finally {await browser.close();}

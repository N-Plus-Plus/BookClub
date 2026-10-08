// Synthetic History pagination/confirmation review; local Vite and optional Playwright only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const source=await (await fetch('http://localhost:4173/frontend/main.tsx')).text();
const reactUrl=source.match(/from "([^"\n]+\/react\.js[^"\n]*)"/)[1],domUrl=source.match(/from "([^"\n]+\/react-dom_client\.js[^"\n]*)"/)[1];
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',()=>{throw new Error('Unexpected browser-native dialog');});
 await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort());
 await page.route('**/api/v1/**',route=>route.abort());
 await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`export const api=globalThis.__reviewApi ??= {};export class ApiClientError extends Error {}`}));
 await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`
 import React from '${reactUrl}';import ReactDOM from '${domUrl}';import '/style.css';import '/frontend/app.css';import '/node_modules/@fontsource/lexend-deca/400.css';
 import {HistoryScreen} from '/frontend/HistoryScreen.tsx';import {api} from '/frontend/api.ts';
 const member={id:'m',display_name:'Member',sort_order:1,active:1,avatar:1,role:'admin'};
 const movie={id:'film',title:'A very long synthetic film title for the deletion confirmation',year:2000,runtime:100,original_title:null,release_date:null,overview:null,director:null,genres:[],assets:[],external_ids:[],scores:[],seen:[],classic:false,ranking:null};
 const cycles=Array.from({length:6},(_,i)=>({id:'cycle-'+i,ordinal:6-i,rough_date:'2030-01-01',title:null}));
 const sessions=cycles.map((cycle,i)=>({id:'event-'+i,event_date:'2030-01-01',cycle_id:cycle.id,cycle_slot:1,host_member_id:'m',kind:'hosted',date_precision:'exact',legacy_cycle_label:null,has_audit:true,movies:[movie]}));
 window.deletes=0;api.audit=async()=>[];api.deleteSession=id=>{window.deletes++;return new Promise(resolve=>{window.finishDelete=()=>resolve({removedSessionId:id});});};
 function Screen(){const [catalog,setCatalog]=React.useState({members:[member],movies:[movie],cycles,sessions});return React.createElement(HistoryScreen,{catalog,viewer:member,onChanged:result=>setCatalog(current=>({...current,sessions:current.sessions.filter(session=>session.id!==result.removedSessionId)}))});}
 const root=ReactDOM.createRoot(document.getElementById('root'));let visit=0;window.renderHistory=()=>root.render(React.createElement('main',{className:'bookclub-shell'},React.createElement(Screen,{key:++visit})));window.renderHistory();
 `}));
 await page.goto('http://localhost:4173/');await page.waitForFunction(()=>Boolean(window.renderHistory));await fs.mkdir('.verification/shared-controls',{recursive:true});
 let expectedDeletes=0;
 for(const width of [320,390,720,1440]) {
  await page.setViewportSize({width,height:900});await page.evaluate(()=>window.renderHistory());await page.getByText('Page 1 of 2',{exact:true}).first().waitFor();
  assert(await page.getByRole('button',{name:'Previous',exact:true}).first().isDisabled());await page.getByRole('button',{name:'Next',exact:true}).first().click();assert(await page.getByRole('button',{name:'Next',exact:true}).first().isDisabled());await page.getByRole('button',{name:'Previous',exact:true}).first().click();
  const opener=page.getByRole('button',{name:'Delete event',exact:true}).first();await opener.focus();await opener.click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('heading',{name:'Remove event from History'}).waitFor();assert((await dialog.innerText()).includes(movieTitle()));await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert(await opener.evaluate(element=>element===document.activeElement));assert.equal(await page.evaluate(()=>window.deletes),expectedDeletes);
  await opener.click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>window.deletes),expectedDeletes);
  await opener.click();await dialog.getByRole('button',{name:'Remove event',exact:true}).click();expectedDeletes++;assert.equal(await page.evaluate(()=>window.deletes),expectedDeletes);assert(await dialog.getByRole('button',{name:'Removing…'}).isDisabled());await page.keyboard.press('Escape');assert.equal(await dialog.count(),1);
  assert(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1));assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await page.screenshot({path:'.verification/shared-controls/history-delete-'+width+'.png',fullPage:true});
  await page.evaluate(()=>window.finishDelete());await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(await page.locator('.history-event').count(),5);assert.equal(await page.locator('#cycle-0').count(),0);assert.equal(await page.evaluate(()=>window.deletes),expectedDeletes);
 }
 assert.deepEqual(errors,[]);console.log('4 responsive History pagination/deletion checks passed: focus, Escape, Cancel, busy guard, one mutation and no external requests.');
} finally {await browser.close();}
function movieTitle(){return 'A very long synthetic film title';}

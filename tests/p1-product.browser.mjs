// Synthetic responsive AU availability/Classics attestation; all provider/API requests blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const source=await (await fetch('http://localhost:4173/frontend/main.tsx')).text();
const reactUrl=source.match(/from "([^"\n]+\/react\.js[^"\n]*)"/)[1],domUrl=source.match(/from "([^"\n]+\/react-dom_client\.js[^"\n]*)"/)[1];
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
await fs.mkdir('.verification/p1-product',{recursive:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
 await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort());
 await page.route('**/api/v1/**',route=>{errors.push('Unexpected API request');return route.abort();});
 await page.route('**/frontend/main.tsx*',route=>route.fulfill({contentType:'application/javascript',body:`
 import React from '${reactUrl}';import ReactDOM from '${domUrl}';import '/style.css';import '/frontend/app.css';
 import {EventScreen} from '/frontend/EventScreen.tsx';import {FilmPicker} from '/frontend/FilmPicker.tsx';import {rankMovie} from '/shared/ranking.ts';import {api} from '/frontend/api.ts';
 const members=[{id:'member',display_name:'Member',active:1,sort_order:1}];
 const movies=[1,2,3].map(i=>{const seen=[{member_id:'member',seen:0,updated_at:''}],scores=[{provider:'imdb',metric:'rating',raw_value:10-i,raw_scale:10,normalized_value:100-i*10,vote_count:1,fetched_at:'',retrieved_via:'omdb'}];return {id:'f'+i,title:'A deliberately long Ranked Classic title for responsive presentation '+i,year:2000,runtime:100,original_title:null,release_date:null,overview:null,genres:[],external_ids:[],assets:[],scores,seen,classic:true,ranking:rankMovie(scores,seen,members,i),au_watch_offers:[{service_id:'1',name:'Netflix',access_type:'subscription'},{service_id:'2',name:'ABC iview',access_type:'free'},{service_id:'3',name:'SBS On Demand',access_type:'ads'},{service_id:'4',name:'Apple TV',access_type:'rent'},{service_id:'4',name:'Apple TV',access_type:'buy'}]};});
 api.saveSession=async input=>{window.saved=input;return {};};
 const event=React.createElement(EventScreen,{catalog:{members,movies,sessions:[],cycles:[]},rotation:{id:1,cycle_id:null,nominal_slot:5,version:9,updated_at:''},writesEnabled:true,onMovie:()=>{},onSaved:()=>{},viewer:null});
 const builder=React.createElement(FilmPicker,{builder:true,movieById:new Map(movies.map(movie=>[movie.id,movie])),selected:movies,onSelected:()=>{},onMovie:()=>{}});
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('main',{className:'stack'},location.search.includes('builder')?builder:event));
 `}));
 for(const width of [320,390,720,1440]){
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/event');await page.locator('.classics-attestation').waitFor();
  const choices=page.locator('.classics-attestation input');assert.equal(await choices.count(),3);
  for(let i=0;i<2;i++){assert(await choices.nth(i).isChecked());assert(await choices.nth(i).isDisabled());}
  assert(!await choices.nth(2).isChecked());await choices.nth(2).check();await page.getByRole('button',{name:'Save event',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.saved.movie_ids),['f1','f2','f3']);
  await choices.nth(2).uncheck();await page.getByRole('button',{name:'Save event',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.saved.movie_ids),['f1','f2']);
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await page.screenshot({path:`.verification/p1-product/classics-${width}.png`,fullPage:true});
  await page.goto('http://localhost:4173/?builder#/builder');await page.locator('.au-availability').first().waitFor();
  assert((await page.locator('.au-availability').first().innerText()).includes('Stream: Netflix'));assert((await page.locator('.au-availability').first().innerText()).includes('Rent: Apple'));
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await page.screenshot({path:`.verification/p1-product/builder-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('8 AU Builder/Classics responsive scenarios passed at 320/390/720/1440px; no API/provider calls.');
}finally{await browser.close();}

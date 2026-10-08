// Focused, synthetic Film Detail render; requires local Vite and optional Playwright.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.BOOKCLUB_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => console.error(error.message));
  await page.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
  await page.route('**/api/v1/**', route => route.abort());
  await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`export const api=globalThis.__reviewApi ??= {};export class ApiClientError extends Error {}`}));
  await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/, route => route.fulfill({contentType:'text/javascript',body:`
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import '/node_modules/@fontsource/lexend-deca/400.css';
import '/node_modules/@fontsource/lexend-deca/600.css';
import '/style.css';import '/frontend/app.css';
import {RankingCard} from '/frontend/components.tsx';
import {ClassicsScreen} from '/frontend/ClassicsScreen.tsx';
import {DetailScreen} from '/frontend/DetailScreen.tsx';
import {SeenScreen} from '/frontend/SeenScreen.tsx';
import {api} from '/frontend/api.ts';
import {rankMovie} from '/shared/ranking.ts';
import {ratingDimensions,sourceRatingKeys} from '/shared/rating-dimensions.ts';
window.scoreGlossary=sourceRatingKeys.map(key=>[ratingDimensions[key].compactLabel,ratingDimensions[key].fullLabel]);
const root=ReactDOM.createRoot(document.getElementById('root'));
const members=[{id:'m1',display_name:'Member',active:1,sort_order:1}];
window.renderScores=(screen,count)=>{
const all=[['imdb','rating',81],['letterboxd','rating',92],['metacritic','critic',100],['rottentomatoes','audience',93],['rottentomatoes','critic',100],['tmdb','rating',81],['metacritic','user',91],['trakt','rating',89],['rogerebert','rating',87.5]];
const inputs=count===0?[]:count===5?all.slice(0,6).filter(s=>s[0]!=='letterboxd'):all.slice(0,count);
const scores=inputs.map(([provider,metric,value])=>({provider,metric,raw_value:value,raw_scale:100,normalized_value:value,fetched_at:'2026-10-06',vote_count:null}));
const seen=[{member_id:'m1',seen:0,updated_at:''}];
const movie={id:screen+count,title:'A long film title for responsive source scores',year:2000,runtime:100,original_title:null,release_date:null,director:'Fixture director',genres:[],overview:'Synthetic overview for compact ratings verification.',assets:[],external_ids:[],classic:true,scores,seen,ranking:rankMovie(scores,seen,members),appearances:[]};
api.detail=async()=>movie;
const queueMovie={...movie,seen:[],ranking:rankMovie(scores,[],members)};
const content=screen==='home'?React.createElement('section',{className:'stack'},React.createElement('h2',null,'Next Classics'),React.createElement(RankingCard,{movie,variant:'home',rank:1})):screen==='classics'?React.createElement(ClassicsScreen,{movies:[movie],viewer:null,writesEnabled:false,onMovie:()=>{}}):screen==='seen'?React.createElement(SeenScreen,{key:movie.id,catalog:{movies:[queueMovie],members,sessions:[],cycles:[]},viewerId:'m1',answer:()=>{},writesEnabled:true}):React.createElement(DetailScreen,{key:movie.id,id:movie.id,members});
root.render(React.createElement('main',{className:'bookclub-shell'},content));
};window.renderScores('home',5);
`}));
 await page.goto('http://localhost:4173/');
 await page.waitForFunction(()=>Boolean(window.renderScores));
 await fs.mkdir('.verification/compact-scores',{recursive:true});
 let checks=0;
 for(const width of [320,390,720,1440]){
  await page.setViewportSize({width,height:900});
  for(const screen of ['home','classics','detail','seen'])for(const count of [5,6,7,9]){
   await page.evaluate(({screen,count})=>window.renderScores(screen,count),{screen,count});
   await page.waitForFunction(count=>document.querySelectorAll('.ranking-source-scores > span').length===count,count).catch(async error=>{console.error({width,screen,count,body:await page.locator('body').innerText()});throw error;});
   await page.evaluate(()=>document.fonts.ready);
   const help=page.getByRole('button',{name:'Explain score abbreviations',exact:true});
   assert.equal(await help.count(),1);
   const placement=await page.evaluate(()=>{
    const button=document.querySelector('.source-scores-help').getBoundingClientRect(),row=document.querySelector('.ranking-source-scores').getBoundingClientRect();
    return {above:button.bottom<=row.top+.5,right:Math.abs(button.right-row.right),target:button.width>=44&&button.height>=44};
   });
   assert(placement.above&&placement.right<1&&placement.target,JSON.stringify({width,screen,count,placement}));
   await help.focus();await page.keyboard.press('Enter');
   await page.getByRole('dialog').waitFor();
   assert.deepEqual(await page.locator('dialog dl > div').evaluateAll(rows=>rows.map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])),await page.evaluate(()=>window.scoreGlossary));
   assert.equal(await page.getByRole('button',{name:'Close score abbreviations'}).evaluate(button=>document.activeElement===button),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(count===5)await page.screenshot({path:'.verification/compact-scores/glossary-'+screen+'-'+width+'.png',fullPage:true});
   if(count%2)await page.keyboard.press('Escape');else await page.getByRole('button',{name:'Close score abbreviations'}).click();
   assert.equal(await page.getByRole('dialog').count(),0);
   assert.equal(await help.evaluate(button=>document.activeElement===button),true);
   const result=await page.evaluate(()=>{
    const row=document.querySelector('.ranking-source-scores');
    const boundary=row.querySelector('.source-scores-critic-boundary');
    let dividerError=0;
    if(boundary){
     const critic=boundary.getBoundingClientRect(),audience=boundary.previousElementSibling.getBoundingClientRect();
     const padding=parseFloat(getComputedStyle(boundary).paddingLeft);
     const divider=critic.left+parseFloat(getComputedStyle(boundary,'::before').left)+.5;
     const sameLine=audience.top<critic.bottom&&audience.bottom>critic.top;
     const expected=sameLine?(audience.right+critic.left+padding)/2:critic.left+padding/2;
     dividerError=Math.abs(divider-expected);
    }
    return {dividerError,overflow:document.documentElement.scrollWidth>innerWidth,stacked:row.classList.contains('ranking-source-scores-stacked'),warning:/Missing:|using available-score average/.test(document.body.textContent),items:[...row.children].map(el=>({direction:getComputedStyle(el).flexDirection,flex:getComputedStyle(el).flex,text:el.textContent}))};
   });
   assert(!result.overflow,JSON.stringify({width,screen,count})+' page overflow');
   assert(result.dividerError<1,JSON.stringify({width,screen,count,dividerError:result.dividerError}));
   assert(!result.warning);assert.equal(result.stacked,count>6);
   for(const item of result.items){assert.equal(item.flex,'0 0 auto');if(count>6)assert.equal(item.direction,'column');}
   await page.screenshot({path:'.verification/compact-scores/'+screen+'-'+width+'-'+count+'.png',fullPage:true});
   checks++;
  }
 }
 for(const screen of ['home','classics','detail','seen']) {
  await page.evaluate(screen=>window.renderScores(screen,0),screen);
  await page.waitForFunction(()=>!document.querySelector('.ranking-source-scores'));
  assert.equal(await page.getByRole('button',{name:'Explain score abbreviations',exact:true}).count(),0);
 }
 console.log(checks+' responsive screen/count checks passed; no page overflow');
}finally{await browser.close();}

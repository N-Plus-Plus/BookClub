// Synthetic main-thread and DOM-volume investigation. Vite + optional local Playwright; no real API/data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
import { emptyEnrichmentMovie } from '../shared/metrics-enrichment.ts';
import { formatCount } from '../shared/format.ts';
import { metricsInventory } from './helpers/metrics-inventory.ts';
const filmReports=['Top critic','Top audience','Bottom critic','Bottom audience','Most popular','Most obscure','Oldest','Newest','Longest','Shortest'];
assert(filmReports.every(name=>metricsInventory.Records.includes(name)));
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || (process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
const seed=metricsFixture(),n=1000;
const movies=Array.from({length:n},(_,i)=>({...seed.movies[0],id:`synthetic-${i}`,title:`Synthetic film ${i}`,director:`Director ${i%100}`}));
const catalog={...seed,movies,sessions:Array.from({length:Math.ceil(n/3)},(_,i)=>({...seed.sessions[0],id:`session-${i}`,host_member_id:seed.members[i%4].id,movies:movies.slice(i*3,i*3+3)}))};
const enriched={movies:Object.fromEntries(movies.map((m,i)=>[m.id,{...emptyEnrichmentMovie(),metadata:{original_language:i%2?'en':'ja',budget:1000000,revenue:2000000},keywords:Array.from({length:30},(_,j)=>({provider:j%2?'tmdb':'mdblist',name:`theme-${(i*13+j)%500}`})),credits:Array.from({length:15},(_,j)=>({kind:'cast',role:'cast',person_id:`${(i*7+j)%1000}`,name:`Actor ${(i*7+j)%1000}`})),countries:[{code:'US',name:'United States'}]}]))};
let reads=0,release;
const waiting=new Promise(resolve=>{release=resolve;});
const page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 localStorage.setItem('bookclub.dev-member','m1');localStorage.setItem('bookclub.session','synthetic-browser-token');
 window.metricLongTasks=[];
 new PerformanceObserver(list=>window.metricLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
});
await page.route('**/api/v1/**',async route=>{
 const path=new URL(route.request().url()).pathname;assert.equal(route.request().method(),'GET');
 let data;
 if(path.endsWith('/health'))data={status:'ok',environment:'local',authenticationRequired:true,googleAuthConfigured:false,demo:true};
 else if(path.endsWith('/auth/me'))data={viewer:{...catalog.members[0],role:'member'}};
 else if(path.endsWith('/rotation'))data=null;
 else if(path.endsWith('/catalog/compact'))data={...catalog,sessions:catalog.sessions.map(({movies,...s})=>({...s,movie_ids:movies.map(m=>m.id)}))};
 else if(path.endsWith('/metrics/enrichment')){reads++;await waiting;data=enriched;}
 else throw Error(`Unexpected API ${path}`);
 await route.fulfill({json:{data}});
});
// Production builds use the public API hostname; API requests must reach the synthetic handler above.
await page.route('**/*',route=>{const url=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(url.hostname) || url.pathname.startsWith('/api/v1/') ? route.fallback() : route.abort();});
const measure=async(selector,target)=>page.evaluate(({selector,target})=>new Promise((resolve,reject)=>{
 const start=performance.now(),timer=setTimeout(()=>reject(Error(`Timed out ${target}`)),10000);
 document.querySelector(selector).click();
 requestAnimationFrame(function check(){
  const heading=document.querySelector('h1')?.textContent,tab=document.querySelector('[role=tab][aria-selected=true]')?.textContent;
  if(heading===target || tab===target)requestAnimationFrame(()=>{clearTimeout(timer);resolve({target,ms:Math.round(performance.now()-start),nodes:document.querySelectorAll('.metrics-content *').length});});
  else requestAnimationFrame(check);
 });
}),{selector,target});
try{
 await page.goto(`${process.env.BOOKCLUB_METRICS_URL || 'http://localhost:4173'}/#/home`);await page.getByRole('heading',{name:'Quick facts',exact:true}).waitFor();
 const results=[];
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  results.push(await measure('nav a[href="#/metrics"]','Metrics'));
  if(width===390){
   while(reads===0)await page.waitForTimeout(10);
   results.push(await measure('nav a[href="#/home"]','Home')); // navigation works while enrichment is pending
   results.push(await measure('nav a[href="#/metrics"]','Metrics'));assert.equal(reads,1);release();
  }
  await page.getByRole('tab',{name:'Tastes',exact:true}).click();await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});
  await page.getByRole('tab',{name:'Top 5',exact:true}).click();
  for(const name of ['Tastes','Breakdowns','Records','Top 5']){
   const id=await page.getByRole('tab',{name,exact:true}).getAttribute('id');
   results.push({...await measure(`[id="${id}"]`,name),width});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert(await page.locator('.metrics-talent .metrics-frequency-row').count()<=20);
   assert(await page.locator('.metrics-directors .metrics-distribution-label').count()<=20);
   const reports=page.locator('.metrics-film-extreme');
   assert.equal(await reports.count(),name==='Records'?filmReports.length:0);
   let bound=0;
   for(const report of await reports.all()){
    assert(filmReports.includes(await report.locator('h3').textContent()));
    const size=await report.getByRole('button',{name:'Next',exact:true}).count()?5:20;
    assert(await report.locator('a').count()<=size);bound+=size;
   }
   assert(await page.locator('.metrics-film-extreme a').count()<=bound);
   // A fixed per-report budget catches expansion elsewhere without tying it to film count.
   const nodes=await page.locator('.metrics-content *').count();
   assert(nodes<=metricsInventory[name].length*300, `${name}: ${nodes} nodes`);
   if(name==='Breakdowns')for(const row of await page.locator('.staging-revenue-table tbody tr').all())assert(await row.locator('a').count()<=20);
  }
  await page.getByRole('tab',{name:'Records',exact:true}).click();
  const tied=page.locator('.metrics-film-extreme').first();assert((await tied.textContent()).includes(`${formatCount(n)}-way tie`));
  const reachable=new Set();
  for(let index=0;index<Math.ceil(n/5);index++){
   assert.equal(await tied.locator('a').count(),5);
   for(const href of await tied.locator('a').evaluateAll(links=>links.map(link=>link.getAttribute('href'))))reachable.add(href);
   const next=tied.getByRole('button',{name:'Next',exact:true});
   if(index<Math.ceil(n/5)-1){assert.equal(await next.isEnabled(),true);await next.click();}
   else assert.equal(await next.isEnabled(),false);
  }
  assert.equal(reachable.size,n);
  await page.screenshot({path:`.verification/metrics/performance-extremes-${width}.png`,fullPage:true});
  await tied.screenshot({path:`.verification/metrics/performance-card-${width}.png`});
  results.push(await measure('nav a[href="#/home"]','Home'));
 }
 assert.equal(reads,1);assert.deepEqual(errors,[]);
 const longTasks=await page.evaluate(()=>window.metricLongTasks);
 const output={films:n,results,enrichmentReads:reads,longTasks,errors};
 await fs.writeFile('.verification/metrics/performance-results.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output));
}finally{await browser.close();}

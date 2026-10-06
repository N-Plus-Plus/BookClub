import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
import { rankMovie } from '../shared/ranking.ts';
const {chromium}=await import('../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage(),catalog=metricsFixture(),errors=[];
const active=catalog.members.filter(m=>m.active);
const template=catalog.movies[0];
const candidates=['ranked','unranked','seen','history'].map((state,i)=>{
 const seen=state==='unranked'||state==='history'?[]:active.map(m=>({member_id:m.id,seen:state==='seen'?1:0,updated_at:''}));
 const scores=state==='unranked'?[]:template.scores;
 return {...template,id:'candidate-'+state,title:'Candidate '+state,overview:'A long description to review the compact disclosure. '.repeat(20),classic:true,seen,scores,ranking:rankMovie(scores,seen,catalog.members,i)};
});
catalog.movies.push(...candidates);catalog.sessions[0].movies.push(candidates[3]);
let admin=true,removed=0;
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('bookclub.dev-member','m1'));
await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.fallback():r.abort());
await page.route('**/api/v1/**',async r=>{
 const path=new URL(r.request().url()).pathname;let data;
 if(path.endsWith('/health'))data={environment:'local',authenticationRequired:false,demo:true};
 else if(path.endsWith('/auth/me'))data={viewer:{...catalog.members[0],avatar:1,role:admin?'admin':'member'}};
 else if(path.endsWith('/rotation'))data=null;
 else if(path.endsWith('/catalog/compact'))data={...catalog,sessions:catalog.sessions.map(({movies,...s})=>({...s,movie_ids:movies.map(m=>m.id)}))};
 else if(r.request().method()==='DELETE'&&path.endsWith('/classics')) {const id=path.split('/').at(-2);const movie=catalog.movies.find(m=>m.id===id);movie.classic=false;movie.ranking=null;movie.seen=[];removed++;data={...movie,appearances:[]};}
 else throw new Error('Unexpected request '+path);
 await r.fulfill({json:{data}});
});
await fs.mkdir('.verification/mobile-classics',{recursive:true});
try {
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/classics');
  const add=page.locator('.page-heading-actions button');await add.waitFor();
  assert.equal(await page.getByRole('button',{name:'Add Classic',exact:true}).count(),1);
  const heading=await page.locator('.page-heading h1').boundingBox(),button=await add.boundingBox();assert(button.y<heading.y+heading.height&&heading.y<button.y+button.height);assert(button.width<180);
  await add.click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close Add Classic'}).click();
  for(const tab of ['Ranked','Unranked','Seen']){
   await page.getByRole('button',{name:new RegExp('^'+tab+':')}).click();
   const trash=page.locator('.classic-remove').first();assert(await trash.count());
   const geometry=await trash.evaluate(e=>({trash:e.getBoundingClientRect().toJSON(),rank:e.parentElement.querySelector('.rank-number').getBoundingClientRect().toJSON()}));assert(geometry.trash.bottom<=geometry.rank.y+1,JSON.stringify({width,tab,geometry}));
   await trash.click();const dialog=page.getByRole('dialog');assert.match(await dialog.textContent(),/Seen.*No.*Unknown/s);assert.match(await dialog.textContent(),/Candidate/);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(removed,0);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`.verification/mobile-classics/classics-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:390,height:900});await page.goto('http://localhost:4173/#/seen');
 await page.getByRole('heading',{name:'The quick check'}).waitFor();assert(!(await page.locator('.answer-card').textContent()).includes('Candidate history'));
 const more=page.getByRole('button',{name:'More',exact:true});await more.focus();await page.keyboard.press('Enter');assert.equal(await page.getByRole('button',{name:'Less',exact:true}).getAttribute('aria-expanded'),'true');await page.keyboard.press('Enter');
 await page.screenshot({path:'.verification/mobile-classics/seen-390.png',fullPage:true});
 await page.setViewportSize({width:320,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.goto('http://localhost:4173/#/classics');await page.getByRole('button',{name:/^Unranked:/}).click();
 const count=await page.locator('.ranking-row').count();await page.locator('.classic-remove').first().click();await page.getByRole('dialog').getByRole('button',{name:'Remove from Classics',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.ranking-row').length===n,count-1);assert.equal(removed,1);
 admin=false;await page.reload();await page.getByRole('heading',{name:'Classics',exact:true}).waitFor();assert.equal(await page.locator('.classic-remove').count(),0);
 assert.deepEqual(errors,[]);console.log('Classics/Seen responsive and admin interaction checks passed');
}finally{await browser.close();}

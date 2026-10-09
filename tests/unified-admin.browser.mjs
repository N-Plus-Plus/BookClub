// Synthetic durable Admin workflow; every API/provider request is intercepted.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const output='.verification/unified-admin';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage({timezoneId:'Australia/Sydney'}),errors=[],samples=[];
page.on('pageerror',error=>{errors.push(error.message);console.error('Synthetic page error:',error.message);});
await page.route('**/*',route=>{const url=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(url.hostname)?route.fallback():route.abort();});
let jobs={},pending=null,stopped=false,executions=0;
const reply=(route,value)=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
await page.route('**/api/v1/maintenance/jobs**',async route=>{
 const url=new URL(route.request().url()),path=url.pathname.replace('/api/v1/maintenance/jobs',''),input=route.request().method()==='POST'?JSON.parse(route.request().postData()):null;
 if(!path && !input)return reply(route,{jobs:Object.values(jobs)});
 if(!path){const value={...input,started_at:'2026-10-09T00:00:00.000Z',created_at:'2026-10-09T00:00:00.000Z',updated_at:'2026-10-09T00:00:00.000Z',phase:'films',state:'ready',requests:0,diagnostic:null,counts:{pending:6,running:0,successful:0,skipped:0,deferred:0,blocked:0,updated:0,no_change:0},lease:{active:false,owner:null,expiresAt:0},issues:[],issuesNext:null};jobs[value.id]=value;return reply(route,value);}
 const [id,action]=path.slice(1).split('/'),job=jobs[id];assert(job,'known durable job');
 if(!action)return reply(route,job);
 if(action==='claim'){job.lease={active:true,owner:'Synthetic admin',expiresAt:Date.now()+180000};return reply(route,{token:'01234567-89ab-4cde-8f01-234567890abc',job});}
 if(action==='stop'){stopped=true;return reply(route,job);}
 if(action==='release'){job.lease={active:false,owner:null,expiresAt:0};return reply(route,job);}
 if(action==='retry'){job.counts.pending=job.counts.deferred;job.counts.deferred=0;job.issues=[];job.state='ready';return reply(route,job);}
 if(action==='step'){if(stopped){job.state='paused';stopped=false;return reply(route,job);}pending={route,job};executions++;return;}
 throw Error('Unexpected maintenance action');
});
await page.route('**/api/**',route=>route.request().url().includes('/maintenance/jobs')?route.fallback():(errors.push('Unmocked API request'),route.abort()));
await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:"export const api=window.bookclubSyntheticApi??={};export class ApiClientError extends Error {}export const hasSession=()=>true;export const setUnauthorizedHandler=()=>{};export const setDevMember=()=>{};export const clearSession=()=>{};export const storeSession=()=>{};"}));
const source=await(await fetch('http://localhost:4173/frontend/main.tsx')).text(),reactUrl=source.match(/from "([^"\n]+\/react\.js[^"\n]*)"/)[1],domUrl=source.match(/from "([^"\n]+\/react-dom_client\.js[^"\n]*)"/)[1];
await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`
import React from '${reactUrl}';import ReactDOM from '${domUrl}';import '/style.css';import '/frontend/app.css';
import '/node_modules/@fontsource/lexend-deca/400.css';import '/node_modules/@fontsource/lexend-deca/500.css';import '/node_modules/@fontsource/lexend-deca/600.css';import '/node_modules/@fontsource/lexend-deca/700.css';
import {maintenanceFieldSummary,aggregateFieldSummary} from '/shared/maintenance-contract.ts';import {App} from '/frontend/App.tsx';import {metricsFixture} from '/tests/metrics-fixture.ts';import {api} from '/frontend/api.ts';
const catalog=metricsFixture();catalog.members.forEach((m,i)=>m.avatar=i+1);catalog.sessions=[];
api.health=async()=>({status:'ok',environment:'test',authenticationRequired:true,demo:false});api.me=async()=>({viewer:{...catalog.members[0],role:'admin'}});api.catalog=async()=>catalog;api.rotation=async()=>({id:1,nominal_slot:1,cycle_id:null,version:0,updated_at:''});api.builders=async()=>[];
const request=(path='',body)=>fetch('/api/v1/maintenance/jobs'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}).then(r=>r.json());
api.maintenanceJobs=()=>request();api.maintenanceJob=id=>request('/'+id);api.createMaintenanceJob=(id,intent,operation)=>request('',{id,intent,operation});api.claimMaintenanceJob=id=>request('/'+id+'/claim',{});api.stepMaintenanceJob=(id,token)=>request('/'+id+'/step',{token});api.releaseMaintenanceJob=(id,token)=>request('/'+id+'/release',{token});api.stopMaintenanceJob=id=>request('/'+id+'/stop',{});api.retryMaintenanceJob=id=>request('/'+id+'/retry',{});
window.expectedSummary=operation=>operation==='all'?aggregateFieldSummary():maintenanceFieldSummary(operation);
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
`}));
const waitPending=async()=>{for(let i=0;i<250;i++){if(pending)return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('No bounded step received');};
const finish=async(mode)=>{const {route,job}=pending;pending=null;job.requests++;
 if(mode==='partial'){job.counts.successful=3;job.counts.updated=3;job.counts.pending=3;job.state='running';}
 if(mode==='issues'){job.counts.successful=5;job.counts.updated=5;job.counts.pending=0;job.counts.deferred=1;job.state='completed_with_issues';job.phase='collections';job.issues=[{key:'collection:8',movieId:null,collectionId:8,provider:'tmdb',operations:['collection-rosters'],category:'record',message:'Malformed roster. Previous valid evidence is preserved.',attempts:1,retryAt:null}];}
 if(mode==='complete'){job.counts.successful=6;job.counts.updated=6;job.counts.pending=0;job.counts.deferred=0;job.issues=[];job.state='completed';}
 await reply(route,job);
};
try{
 for(const width of [320,390,720,951,1440]){
  jobs={};pending=null;stopped=false;executions=0;await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/admin');await page.reload();await page.getByRole('button',{name:'Refresh all data',exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#refresh-all-heading').parentElement.querySelector('button').disabled);
  assert.equal(await page.locator('main .classics-maintenance').count(),18);assert.equal(executions,0);
  const summaries=await page.locator('main .classics-maintenance').evaluateAll(cards=>cards.map(card=>{const h=card.querySelector('h3'),p=h.nextElementSibling,operation=h.id.replace(/^(populate|refresh)-/,'').replace(/-heading$/,'');return {text:p.textContent,expected:window.expectedSummary(operation),font:getComputedStyle(p).fontSize};}));for(const item of summaries){assert.equal(item.text,item.expected);assert.equal(item.font,'13px');}
  await page.getByRole('button',{name:'Refresh all data',exact:true}).click();assert.equal(executions,0);await page.getByRole('dialog').getByRole('button',{name:'Start new run'}).click();await waitPending();assert(await page.getByRole('button',{name:'Refresh collection rosters',exact:true}).isDisabled());
  await page.getByRole('button',{name:'Stop after current batch'}).click();await finish('partial');await page.getByRole('button',{name:'Resume remaining'}).waitFor();await page.getByRole('button',{name:'Stop after current batch'}).waitFor({state:'hidden'});
  assert.equal(executions,1);const id=Object.keys(jobs)[0];assert.equal(jobs[id].counts.successful,3);await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:'Resume remaining'}).waitFor();assert.equal(Object.keys(jobs).length,1);
  await page.getByRole('button',{name:'Resume remaining'}).click();await waitPending();await finish('issues');await page.getByText('All executable work was processed.',{exact:false}).waitFor();const card=page.locator('#refresh-all-heading').locator('..');assert((await card.innerText()).includes('5 successful'));assert((await card.innerText()).includes('1 deferred'));assert.equal(await card.getByRole('button',{name:'Resume remaining'}).count(),0);
  await card.locator('details').first().locator('summary').click();assert((await card.innerText()).includes('Collection 8'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const bounds=await page.locator('main .card button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,height:r.height,left:r.left,right:r.right};}));for(const b of bounds){assert(b.height>=44,b.text+' touch target');assert(b.left>=0&&b.right<=width,b.text+' containment');}
  await page.screenshot({path:output+'/durable-issues-'+width+'.png',fullPage:true});
  await card.getByRole('button',{name:'Retry this issue'}).click();await waitPending();assert.equal(jobs[id].counts.successful,5);assert.equal(jobs[id].counts.pending,1);await finish('complete');await page.getByRole('button',{name:'Stop after current batch'}).waitFor({state:'hidden'});assert.equal(jobs[id].counts.successful,6);assert.equal(executions,3);assert.equal(Object.keys(jobs).length,1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);samples.push({width,summaries,bounds,executions,jobId:id});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(output+'/measurements.json',JSON.stringify({samples,errors},null,2));console.log('Durable Admin: 18 summaries, Stop, reload/storage deletion, same-job resume, issues, targeted retry, locks and containment passed at 320/390/720/951/1440px.');
}catch(error){await page.screenshot({path:output+'/failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-10000),errors);throw error;}finally{await browser.close();}

// Local-only R01/R02 fixtures: no mutation or provider request reaches a Worker.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || (process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true});
try {
 const context=await browser.newContext();
 const health=(await (await context.request.get('http://localhost:8787/api/v1/health')).json()).data;
 assert.equal(health.environment,'local');assert.equal(health.authenticationRequired,false);
 const local=(await (await context.request.get('http://localhost:8787/api/v1/catalog')).json()).data;
 const members=local.members.map((member,index)=>({...member,display_name:`Host ${index+1}`}));
 const viewer={...members[0],role:'admin'};
 const base=local.movies.find(movie=>movie.classic&&movie.ranking?.eligible&&!movie.ranking.rankable);
 assert(base);
 const makeFilm=(id,title)=>({...structuredClone(base),id,title,original_title:null,overview:null,genres:[],assets:[],scores:[],seen:[],external_ids:[{provider:'imdb',external_id:'tt1234567'}],classic:true,appearances:[]});
 let a,b,seenFail,memberFail,scoreFail,loadFail,bulkFail;
 let detailLoads=0,seenGate=null;
 const seenRequests=[],membershipRequests=[],scoreRequests=[],pageErrors=[],checks=[];
 const providers=(message)=>[{provider:'mdblist',status:'success',count:0,message}];
 let candidateResults={};
 const reset=()=>{a=makeFilm('feedback-a','Fixture film A with a longer title');b=makeFilm('feedback-b','Fixture film B');seenFail=memberFail=scoreFail=true;loadFail=bulkFail=false;candidateResults={};};
 reset();
 await context.addInitScript(id=>localStorage.setItem('bookclub.dev-member',id),viewer.id);
 await context.route('**/api/v1/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
  const ok=data=>route.fulfill({json:{data}}),fail=message=>route.fulfill({status:503,json:{error:{message}}});
  if(path.endsWith('/health')) return ok(health);
  if(path.endsWith('/catalog')) return ok({members,movies:[a,b],sessions:[],cycles:[]});
  if(path.endsWith('/auth/me')) return ok({viewer});
  if(path.endsWith('/rotation')) return ok(null);
  const seen=path.match(/\/movies\/feedback-a\/seen\/([^/]+)$/);
  if(seen&&method==='PUT') {
   const body=request.postDataJSON();seenRequests.push({member:seen[1],...body});
   if(seenFail) return fail('Fixture answer unavailable.');
   if(seenGate) await seenGate;
   a.seen=a.seen.filter(answer=>answer.member_id!==seen[1]);
   if(body.seen!==null) a.seen.push({member_id:seen[1],seen:Number(body.seen),updated_at:'2026-10-05T00:00:00Z'});
   return ok(a);
  }
  if(path.endsWith('/feedback-a/classics')&&method==='PUT') {
   const body=request.postDataJSON();membershipRequests.push(body);
   if(memberFail) return fail('Fixture membership unavailable.');
   a.classic=body.classic;return ok(a);
  }
  const score=path.match(/\/movies\/(feedback-[ab])\/refresh-scores$/);
  if(score&&method==='POST') {
   scoreRequests.push(score[1]);
   if(scoreFail) return fail('Fixture refresh response unavailable.');
   const result=candidateResults[score[1]]??providers('Fixture score check complete.');
   if(result==='error') return fail('Fixture candidate B unavailable.');
   return ok({movie:score[1]==='feedback-a'?a:b,providers:result});
  }
  if(path.endsWith('/classics/enrich')&&method==='POST') {
   if(bulkFail) return fail('Fixture bulk response unavailable.');
   return ok({remaining:7,unidentified:3,results:[
    {movie:a,providers:[{provider:'mdblist',status:'success',count:2,message:'Fixture bulk scores captured.'},{provider:'omdb',status:'failed',count:0,message:'Fixture bulk provider unavailable.',retryAfter:60}]},
    {movie:b,providers:[{provider:'mdblist',status:'skipped',count:0,message:'Fixture bulk skipped after outage.',retryAfter:60}]},
   ]});
  }
  if(path.endsWith('/movies/feedback-a')&&method==='GET') {detailLoads++;return loadFail?fail('Fixture detail unavailable.'):ok(a);}
  return route.abort();
 });
 await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort());
 const page=await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
 const shot=async(width,state)=>{await page.screenshot({path:`.verification/feedback-${width}-${state}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${state}: overflow`);checks.push({width,state});};
 const openMaintenance=()=>page.getByText('Classics membership & score maintenance',{exact:true}).click();
 for(const width of [320,390,720,768,1024,1440]) {
  reset();await page.setViewportSize({width,height:900});await page.goto('http://localhost:4173/#/movie/feedback-a');
  await page.getByRole('heading',{name:a.title,exact:true}).waitFor();
  assert(await page.getByText('No overview available yet.',{exact:true}).isVisible());await shot(width,'loaded');
  const row=page.locator('.member-state').first(),name=members[0].display_name.toUpperCase(),before=detailLoads;
  await row.getByRole('button',{name:`Set ${name} to Yes`,exact:true}).click();
  await row.getByText(/Could not save Yes/).waitFor();
  assert.equal(await row.getByRole('button',{name:`Set ${name} to Unknown`,exact:true}).getAttribute('aria-pressed'),'true');
  assert(await page.getByRole('heading',{name:a.title,exact:true}).isVisible());
  assert.equal(await page.getByRole('button',{name:'Retry film load',exact:true}).count(),0);
  assert.equal(await page.locator('.refresh-failure').count(),0);
  assert.equal(await page.locator('details').filter({has:page.getByText('Classics membership & score maintenance',{exact:true})}).getByRole('alert').count(),0);
  await shot(width,'seen-failure');
  const rejectedRetry=page.waitForResponse(response=>response.url().includes('/seen/')&&response.status()===503);
  await row.getByRole('button',{name:`Retry ${name} answer: Yes`,exact:true}).click();await rejectedRetry;
  await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-retry')&&!document.activeElement.disabled);
  assert.equal(await row.getByRole('button',{name:`Set ${name} to Unknown`,exact:true}).getAttribute('aria-pressed'),'true');
  seenFail=false;await row.getByRole('button',{name:`Retry ${name} answer: Yes`,exact:true}).click();
  await page.waitForFunction(id=>document.getElementById(`answer-${id}-true`)?.getAttribute('aria-pressed')==='true',members[0].id);
  assert.equal(await row.getByRole('alert').count(),0);assert.equal(detailLoads,before);
  assert.deepEqual(seenRequests.slice(-2),[{member:members[0].id,seen:true},{member:members[0].id,seen:true}]);
  await page.waitForFunction(id=>document.activeElement?.id===`answer-${id}-true`,members[0].id);
  await shot(width,'seen-retry-success');
  seenFail=true;await row.getByRole('button',{name:`Set ${name} to No`,exact:true}).click();await row.getByText(/Could not save No/).waitFor();
  seenFail=false;await row.getByRole('button',{name:`Set ${name} to Unknown`,exact:true}).click();
  await page.waitForFunction(id=>document.getElementById(`answer-${id}-null`)?.getAttribute('aria-pressed')==='true',members[0].id);
  assert.equal(await row.getByRole('button',{name:/^Retry /}).count(),0);
  if(width===1440) {
   seenFail=true;await row.getByRole('button',{name:`Set ${name} to Yes`,exact:true}).click();await row.getByText(/Could not save Yes/).waitFor();
   let release;seenGate=new Promise(resolve=>{release=resolve;});seenFail=false;
   await row.getByRole('button',{name:`Retry ${name} answer: Yes`,exact:true}).click();
   const otherFocus=page.getByText('Technical identifiers & artwork',{exact:true});await otherFocus.focus();release();
   await page.waitForFunction(id=>document.getElementById(`answer-${id}-true`)?.getAttribute('aria-pressed')==='true',members[0].id);
   assert(await otherFocus.evaluate(element=>element===document.activeElement));seenGate=null;
  }
  await openMaintenance();const maintenance=page.locator('details').filter({has:page.getByText('Classics membership & score maintenance',{exact:true})});
  await maintenance.getByRole('button',{name:'Remove from Classics',exact:true}).click();await maintenance.getByText(/membership change could not be confirmed/).waitFor();
  assert.equal(await page.locator('.refresh-failure').count(),0);assert.equal(await row.getByRole('alert').count(),0);await shot(width,'membership-failure');
  memberFail=false;await maintenance.getByRole('button',{name:'Retry removing from Classics',exact:true}).click();await maintenance.getByText('Removed from Classics.',{exact:true}).waitFor();
  assert.deepEqual(membershipRequests.slice(-2),[{classic:false},{classic:false}]);await shot(width,'membership-retry-success');
  await maintenance.getByRole('button',{name:'Refresh scores',exact:true}).click();await maintenance.getByText(/Score refresh result could not be confirmed/).waitFor();
  assert.equal(await page.locator('.refresh-failure').count(),0);assert(await page.getByRole('heading',{name:a.title,exact:true}).isVisible());
  assert.equal(await maintenance.getByRole('button',{name:/Retry.*scores/}).count(),0);await shot(width,'score-failure');
  const scoresBefore=scoreRequests.length;loadFail=true;await maintenance.getByRole('button',{name:'Check saved film data',exact:true}).click();await maintenance.getByText('Fixture detail unavailable.',{exact:true}).waitFor();
  assert(await page.getByRole('heading',{name:a.title,exact:true}).isVisible());loadFail=false;
  await maintenance.getByRole('button',{name:'Retry saved film data reload',exact:true}).click();await maintenance.getByText(/Saved film data reloaded/).waitFor();assert.equal(scoreRequests.length,scoresBefore);
  scoreFail=false;await maintenance.getByRole('button',{name:'Refresh scores',exact:true}).click();await maintenance.getByText(/Fixture score check complete/).waitFor();
  assert.equal(await maintenance.getByText(/Score refresh result could not be confirmed/).count(),0);await shot(width,'score-success');
  // Two independently keyed candidates, plus a persistent bulk result.
  reset();scoreFail=false;await page.goto('http://localhost:4173/#/classics');await page.getByRole('button',{name:/^Needs Data/}).click();
  const bulk=page.locator('details').filter({has:page.getByText('Admin · score maintenance',{exact:true})});await bulk.locator('summary').click();
  await bulk.getByRole('button',{name:'Enrich up to 10 films',exact:true}).click();await bulk.getByText('Bulk score enrichment result',{exact:true}).waitFor();
  assert(await bulk.getByText('Provider failures: 1 · Films affected: 1',{exact:true}).isVisible());assert(await bulk.getByText(/Wait 60s/).first().isVisible());
  const bulkText=await bulk.innerText();const candidates=page.locator('.ranking-list > .stack'),candidateA=candidates.nth(0),candidateB=candidates.nth(1);
  await candidateA.getByText('Candidate maintenance',{exact:true}).click();await candidateB.getByText('Candidate maintenance',{exact:true}).click();
  assert.equal(await page.locator('.ranking-list').getByText('Bulk score enrichment result',{exact:true}).count(),0);
  candidateResults['feedback-a']=providers('Fixture A first result.');await candidateA.getByRole('button',{name:'Refresh scores',exact:true}).click();await candidateA.getByText(/Fixture A first result/).waitFor();
  assert.equal(await candidateB.getByText(/Fixture A first result/).count(),0);assert.equal(await bulk.innerText(),bulkText);
  candidateResults['feedback-b']='error';await candidateB.getByRole('button',{name:'Refresh scores',exact:true}).click();await candidateB.getByText(/Fixture candidate B unavailable/).waitFor();
  assert(await candidateA.getByText(/Fixture A first result/).isVisible());await shot(width,'bulk-and-candidates');
  candidateResults['feedback-b']=[{provider:'omdb',status:'failed',count:0,message:'Fixture B cooldown.',retryAfter:120}];
  await candidateB.getByRole('button',{name:'Refresh scores',exact:true}).click();await candidateB.getByText(/Wait 120s/).waitFor();
  assert.equal(await candidateB.getByText(/Fixture candidate B unavailable/).count(),0);
  candidateResults['feedback-a']=providers('Fixture A latest result.');await candidateA.getByRole('button',{name:'Refresh scores',exact:true}).click();await candidateA.getByText(/Fixture A latest result/).waitFor();
  assert.equal(await candidateA.getByText(/Fixture A first result/).count(),0);assert(await candidateB.getByText(/Fixture B cooldown/).isVisible());assert.equal(await bulk.innerText(),bulkText);
  await candidateA.getByText('Candidate maintenance',{exact:true}).click();await candidateA.getByText('Candidate maintenance',{exact:true}).click();assert(await candidateA.getByText(/Fixture A latest result/).isVisible());
  await bulk.locator('summary').click();await bulk.locator('summary').click();assert.equal(await bulk.innerText(),bulkText);await shot(width,'scoped-latest-results');
  bulkFail=true;await bulk.getByRole('button',{name:'Enrich up to 10 films',exact:true}).click();await bulk.getByText(/Bulk enrichment result could not be confirmed/).waitFor();
  assert(await candidateA.getByText(/Fixture A latest result/).isVisible());assert(await candidateB.getByText(/Fixture B cooldown/).isVisible());await shot(width,'bulk-response-failure');
 }
 // Initial load recovery owns the generic page retry; no loaded data is invented.
 loadFail=true;await page.goto('http://localhost:4173/#/movie/feedback-a');await page.getByText('Fixture detail unavailable.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:a.title,exact:true}).count(),0);loadFail=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:a.title,exact:true}).waitFor();
 assert.deepEqual(pageErrors,[]);await fs.writeFile('.verification/operation-feedback-results.json',JSON.stringify({checks,pageErrors,seenRequests,membershipRequests,scoreRequests,detailLoads}));
 console.log(`${checks.length} scoped feedback state/width checks passed; R01/R02 behavioural assertions passed.`);
} finally {await browser.close();}

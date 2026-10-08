// Synthetic Admin verification. Requires Vite and optional local Playwright; no API/provider server.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const movies=Array.from({length:24},(_,i)=>({id:`film-${i}`,title:`Synthetic Film ${i}`,original_title:null,year:2000,runtime:101,director:null,overview:null,release_date:null,genres:[],assets:[],scores:[],seen:[],classic:true,ranking:null,external_ids:i<23?[{provider:'tmdb',external_id:String(i+1)},{provider:'imdb',external_id:`tt${String(i+1).padStart(7,'0')}`}]:[]}));
const members=[{id:'member-1',display_name:'Admin fixture',active:1,sort_order:1,avatar:1}];
await fs.mkdir('.verification/admin-enrichment',{recursive:true});
const evidence=[];
try {
  for (const width of [1440,390]) for (const provider of ['tmdb','mdblist']) {
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
    let pending=null,active=0,maxActive=0,calls=0,catalogReads=0,fail=false;
    const waitPending=async()=>{const deadline=Date.now()+10000;while(!pending && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));assert(pending,'Enrichment request did not arrive.');};
    page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(()=>localStorage.setItem('bookclub.dev-member','member-1'));
    await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort());
    await context.route('**/api/v1/**',async route=>{
      const path=new URL(route.request().url()).pathname;let data;
      if(path.endsWith('/health'))data={status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
      else if(path.endsWith('/auth/me'))data={viewer:{...members[0],role:'admin'}};
      else if(path.endsWith('/rotation'))data=null;
      else if(path.endsWith('/catalog/compact')){catalogReads++;data={members,movies,sessions:[],cycles:[]};}
      else if(path.endsWith('/movies/maintenance-status'))data={candidateIds:movies.slice(0,23).map(m=>m.id),eligibleDimensions:138,unavailableDimensions:0,unavailableFilms:0};
      else if(path.endsWith('/movies/enrich-provider-selected')){
        const input=route.request().postDataJSON();assert.equal(input.provider,provider);assert(input.movie_ids.length<=(provider==='tmdb'?2:10));
        active++;maxActive=Math.max(maxActive,active);calls++;
        await new Promise(resolve=>{pending=resolve;});pending=null;active--;
        data={results:input.movie_ids.map(movieId=>({movieId,status:fail?'failed':'updated',message:fail?'Synthetic provider unavailable':'Saved',...(fail?{blocking:true,retryAfter:60}:{})})),canonicalChanged:false,...(fail?{stopped:true}:{})};
      } else throw new Error(`Unexpected API ${path}`);
      await route.fulfill({contentType:'application/json',body:JSON.stringify({data})});
    });
    const label=provider==='tmdb'?'TMDB':'MDBList',other=provider==='tmdb'?'MDBList':'TMDB',card=page.locator('section', {has:page.getByRole('heading',{name:`Refresh ${label} Enrichment`,exact:true})});
    await page.goto('http://localhost:4173/#/admin');await card.waitFor();
    assert((await card.innerText()).includes(`23 eligible films · 1 without a valid ${label} identity.`));
    await card.getByRole('button',{name:`Refresh ${label} enrichment`,exact:true}).click();
    await waitPending();
    assert(await page.getByRole('button',{name:`Refresh ${other} enrichment`,exact:true}).isDisabled());
    assert(await page.getByRole('button',{name:'Refresh scores',exact:true}).isDisabled());
    assert(await page.getByRole('button',{name:'Fill missing TMDB metadata',exact:true}).isDisabled());
    // Browser focus/scroll responds while fetch is deliberately left unresolved.
    const stop=card.getByRole('button',{name:'Stop after this batch',exact:true});await stop.focus();assert(await stop.evaluate(el=>el===document.activeElement));
    await page.evaluate(()=>window.scrollBy(0,120));assert.equal(calls,1);
    assert.equal(await card.getByRole('progressbar').getAttribute('value'),'0');
    pending();const size=provider==='tmdb'?2:10;
    await page.waitForFunction(({provider,size})=>document.querySelector(`#${provider}-enrichment-heading`).closest('section').textContent.includes(`${size} / 23 processed`),{provider,size});
    assert.equal(calls,1); // The next request is paced, not fired immediately.
    await waitPending();
    await page.screenshot({path:`.verification/admin-enrichment/${provider}-${width}-running.png`,fullPage:true});
    await stop.click();assert.equal(calls,2);pending();
    await card.getByText('Stopped. Completed updates are saved; resume to continue.',{exact:true}).waitFor();
    assert((await card.innerText()).includes(`${2*size} / 23 processed`));assert.equal(maxActive,1);assert.equal(catalogReads,provider==='tmdb'?2:1);
    assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),`Page overflow ${provider} ${width}`);
    assert(await card.getByRole('button',{name:/^Resume /}).evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Resume control overflow');
    const progress=card.getByRole('progressbar');assert((await progress.boundingBox()).width>100);assert.equal(await progress.getAttribute('value'),String(2*size));
    const saved=await page.evaluate(provider=>JSON.parse(localStorage.getItem(`bookclub.${provider}-enrichment.v1`)),provider);assert.equal(saved.completed,2*size);assert.equal(saved.remainingIds.length,23-2*size);
    await page.screenshot({path:`.verification/admin-enrichment/${provider}-${width}-stopped.png`,fullPage:true});
    await page.reload();await card.getByRole('button',{name:`Resume ${label} enrichment · ${23-2*size} remaining`,exact:true}).waitFor();
    fail=true;await card.getByRole('button',{name:/^Resume /}).click();await waitPending();pending();
    await card.getByText(/Synthetic provider unavailable/).waitFor();
    const otherCard=page.locator('section',{has:page.getByRole('heading',{name:`Refresh ${other} Enrichment`,exact:true})});assert(!(await otherCard.innerText()).includes('Synthetic provider unavailable'));
    assert.deepEqual(errors,[]);assert.equal(maxActive,1);
    evidence.push({provider,width,calls,maxActive,completed:saved.completed,pending:saved.remainingIds.length,overflow:false,responsive:true});
    await context.close();
  }
  await fs.writeFile('.verification/admin-enrichment/results.json',JSON.stringify(evidence,null,2));
  console.log('4 Admin desktop/mobile scenarios passed: progress, pacing, Stop/resume, shared lock, local failures, responsiveness and no overflow.');
} finally {await browser.close();}

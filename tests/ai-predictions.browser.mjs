import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const uiBase=process.env.BOOKCLUB_UI_URL || 'http://localhost:4173';
const out='.verification/ai-predictions';await fs.mkdir(out,{recursive:true});
const catalog=metricsFixture();catalog.sessions=[];catalog.cycles=[];
catalog.movies.forEach((m,i)=>{m.classic=false;m.assets=[{provider:'manual',asset_type:'poster',reference:`/prediction-${i}.svg`,width:100,height:150,preferred:1}];});
catalog.members[1].display_name='A participant with a long display name';
const ids=catalog.movies.slice(0,3).map(m=>m.id);
let predictions=ids.map(movie_id=>({member_id:catalog.members[1].id,movie_id})),show=false,turn=2;
const errors=[],requests=[],checks=[];
const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>{localStorage.setItem('bookclub.dev-member','m1');Math.random=()=>0;});
await context.route('**/prediction-*.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100" height="150" fill="#263238"/><circle cx="50" cy="60" r="30" fill="#c78964"/><text x="50" y="120" text-anchor="middle" fill="white" font-size="14">Film poster</text></svg>'}));
await context.route('**/api/v1/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,method=request.method();requests.push({path,method});let data;
  if(path.endsWith('/health'))data={status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
  else if(path.endsWith('/auth/me'))data={viewer:{...catalog.members[0],avatar:0,role:'admin'}};
  else if(path.endsWith('/auth/preferences')){if(method==='PUT')show=request.postDataJSON().show_ai;data={show_ai:show};}
  else if(path.endsWith('/catalog/compact'))data={...catalog,sessions:[]};
  else if(path.endsWith('/rotation'))data={id:1,nominal_slot:turn,cycle_id:turn===1?null:'c',version:1,updated_at:''};
  else if(path.endsWith('/predictions')){if(method!=='GET'){const input=request.postDataJSON();predictions=predictions.filter(p=>p.member_id!==input.member_id||p.movie_id!==input.movie_id);if(method==='POST')predictions.push(input);}data=predictions;}
  else if(path.endsWith('/history-export'))data={filename:'bookclub-participant-history.txt',text:'Title,Year,IMDb ID,TMDB ID\r\n"A, film",2020,tt1234567,123\r\n'};
  else if(path.endsWith('/movies/search'))data={local:[{id:catalog.movies[3].id,title:catalog.movies[3].title,year:2000,tmdbId:null,poster:null}],external:[{provider:'tmdb',externalId:'42',title:'Imported prediction',year:2026,poster:null}],lookup:{available:true,message:null}};
  else if(path.includes('/movies/preview/tmdb/'))data={provider:'tmdb',externalId:'42',title:'Imported prediction',original_title:null,year:2026,release_date:null,runtime:100,overview:null,genres:[],assets:[],director:null};
  else if(path.endsWith('/movies/import')){const film={...catalog.movies[0],id:'imported',title:'Imported prediction',external_ids:[{provider:'tmdb',external_id:'42'}],appearances:[]};if(!catalog.movies.some(m=>m.id==='imported'))catalog.movies.push(film);data=film;}

  else if(path.endsWith('/maintenance/jobs'))data={jobs:[]};
  else if(path.endsWith('/admin/data-health'))data={films:[],scanned:0,next:null,partial:false};
  else if(path.endsWith('/builders'))data=[];
  else if(path.endsWith('/movies/maintenance-coverage'))data={checks:[],negativeScores:[],enrichment:[],evidence:[],evidenceSupported:true,fieldsSupported:true,fields:[],scoreEligibleIds:predictions.map(p=>p.movie_id),unavailable:{tmdb:null,omdb:null,mdblist:null},next:null};
  else if(path.includes('/movies/'))data={...catalog.movies.find(m=>m.id===path.split('/').at(-1)),appearances:[]};
  else throw Error('Unexpected synthetic API '+path);
  await route.fulfill({contentType:'application/json',body:JSON.stringify({data})});
});
const overflow=async(name,width)=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${width}: overflow`);
const go=async path=>{await page.evaluate(path=>location.hash='/'+path,path);};
try{
  for(const width of [320,390,720,951,1440]){
    await page.setViewportSize({width,height:1000});show=false;turn=2;
    await page.goto(`${uiBase}/?width=${width}#/home`);await page.getByRole('heading',{name:'Club timeline',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.turn-predictions').count(),0);
    await page.locator('.account-menu-trigger').click();await page.getByRole('button',{name:'Show AI',exact:true}).click();await page.locator('.prediction-poster').waitFor();await page.locator('.account-menu-trigger').click();
    assert.equal(await page.locator('.turn-actions a:last-child').innerText(),'Event');assert.equal(await page.locator('.turn-predictions h3').innerText(),'Will they bring...');
    const geometry=await page.locator('.turn-row').evaluate(row=>[...row.children].map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()})));
    const proportions=await page.locator('.turn-predictions').evaluate(e=>({height:e.getBoundingClientRect().height,identityHeight:document.querySelector(innerWidth<720?'.turn-identity .club-identity':'.turn-identity').getBoundingClientRect().height,nominalIdentityHeight:(()=>{const identity=document.querySelector('.turn-identity'),name=identity.querySelector('.club-identity > span');return identity.getBoundingClientRect().height-name.getBoundingClientRect().height+parseFloat(getComputedStyle(name).lineHeight);})(),headingSize:getComputedStyle(e.querySelector('h3')).fontSize,gap:getComputedStyle(e).gap,poster:e.querySelector('.poster').getBoundingClientRect().toJSON()}));
    assert.equal(proportions.headingSize,'11px');assert.equal(proportions.gap,'4px');assert.equal(proportions.poster.height,width<720?72:120);if(width>=951)assert(Math.abs(proportions.height-proportions.nominalIdentityHeight)<45,JSON.stringify(proportions));else assert(proportions.height<=proportions.identityHeight+24,JSON.stringify(proportions));
    assert.equal(geometry.length,3);if(width>=951){assert(geometry[0].rect.right<=geometry[1].rect.left);assert(geometry[1].rect.right<=geometry[2].rect.left);}
    const timing=await page.locator('.prediction-poster').evaluate(async e=>{const animation=e.getAnimations()[0];if(!animation)throw Error('Missing animation');animation.pause();const opacities=[];for(const time of [0,200,400,3000,5400,5700,6000,6050,6100,6200]){animation.currentTime=time;await new Promise(requestAnimationFrame);opacities.push(Number(getComputedStyle(e).opacity));}const result={duration:animation.effect.getTiming().duration,opacities};return result;});
    assert.equal(timing.duration,6100);assert(timing.opacities[0]<0.05);assert(Math.abs(timing.opacities[1]-.5)<.05);assert(timing.opacities[2]>.95);assert.equal(timing.opacities[3],1);assert(timing.opacities[4]>.95);assert(Math.abs(timing.opacities[5]-.5)<.05);assert(timing.opacities[6]<.00001);assert(timing.opacities.slice(7).every(value=>value===0));
    await page.locator('.prediction-poster').evaluate(e=>{e.getAnimations()[0].currentTime=400;});await page.evaluate(()=>new Promise(requestAnimationFrame));
    await overflow('Home',width);await page.screenshot({path:`${out}/home-${width}.png`,fullPage:true});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);assert.equal(await page.locator('.prediction-animated').count(),0);await page.emulateMedia({reducedMotion:'no-preference'});
    if(width===1440){
      // Observe actual React replacement, including the frame after CSS completion.
      await page.reload();await page.locator('.prediction-poster').waitFor();
      const frames=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let previous=null,start=performance.now();function sample(){const e=document.querySelector('.prediction-poster'),animation=e.getAnimations()[0],time=animation?.currentTime;samples.push({href:e.getAttribute('href'),opacity:Number(getComputedStyle(e).opacity),time,changed:previous!==null&&previous!==e});previous=e;if(performance.now()-start<6500)requestAnimationFrame(sample);else resolve(samples);}requestAnimationFrame(sample);}));
      assert(frames.some(f=>f.changed),'poster replaced on real timer');assert(frames.filter(f=>f.changed).every(f=>f.opacity<.1),'replacement starts invisible');assert(frames.filter(f=>f.time>=6000).every(f=>f.opacity<.00001),'outgoing stays invisible through replacement');
      await fs.writeFile(`${out}/replacement-frames.json`,JSON.stringify(frames));
    }
    await go('admin');await page.getByRole('heading',{name:'AI predicted',exact:true}).waitFor();
    const selector=page.locator('.ai-predictions-card select').first(),exportSelector=page.locator('.prediction-export select');
    assert.equal(await selector.inputValue(),'');assert.equal(await exportSelector.inputValue(),catalog.members[0].id);
    assert.equal(await page.locator('.ai-predictions-card .film-search-form,.prediction-list').count(),0);
    await selector.selectOption(catalog.members[1].id);
    assert.equal(await page.locator('.prediction-list li').count(),3);
    const saved=JSON.stringify(predictions),writes=requests.filter(r=>r.path.endsWith('/predictions')&&r.method!=='GET').length;
    await selector.selectOption('');assert.equal(await page.locator('.ai-predictions-card .film-search-form,.prediction-list').count(),0);
    assert.equal(JSON.stringify(predictions),saved);assert.equal(requests.filter(r=>r.path.endsWith('/predictions')&&r.method!=='GET').length,writes);assert.equal(await exportSelector.inputValue(),catalog.members[0].id);
    await selector.selectOption(catalog.members[1].id);
    const headings=await page.locator('.admin-screen').evaluate(e=>[...e.children].map(c=>c.querySelector('h2')?.textContent));assert.deepEqual(headings.slice(0,4),['Swap current turn','AI predicted','Data health and exceptions','Populate missing data']);
    assert.equal(await page.locator('.prediction-list li').count(),3);await overflow('Admin',width);await page.screenshot({path:`${out}/admin-${width}.png`,fullPage:true});
    await page.locator('.prediction-list button').first().click();assert.equal(await page.locator('dialog').count(),0);await page.waitForFunction(()=>document.querySelectorAll('.prediction-list li').length===2);
    await page.getByRole('textbox',{name:'Search films'}).fill('film');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:`Select ${catalog.movies[3].title}`,exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.prediction-list li').length===3);
    await page.getByRole('textbox',{name:'Search films'}).fill('import');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('button',{name:'Select Imported prediction',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.prediction-list li').length===4);
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'bookclub-participant-history.txt');const file=await download.path();assert.equal(await fs.readFile(file,'utf8'),'Title,Year,IMDb ID,TMDB ID\r\n"A, film",2020,tt1234567,123\r\n');
    await go('home');await page.locator('.prediction-poster').waitFor();await page.locator('.account-menu-trigger').click();await page.getByRole('button',{name:'Hide AI',exact:true}).click();assert.equal(await page.locator('.turn-predictions').count(),0);
    turn=5;show=true;await page.reload();await page.getByRole('heading',{name:'Club timeline',exact:true}).waitFor();assert.equal(await page.locator('.turn-predictions').count(),0);
    predictions=ids.map(movie_id=>({member_id:catalog.members[1].id,movie_id}));checks.push({width,geometry,proportions,timing,overflow:false});
  }
  assert.deepEqual(errors,[]);assert(!requests.some(r=>r.method==='POST' && /maintenance|refresh-scores|enrich/.test(r.path)));
  await fs.writeFile(`${out}/browser-results.json`,JSON.stringify({checks,errors,requests},null,2));console.log('AI Home/Admin browser checks passed at five widths; timing, reduced motion, toggle, lookup/import/removal/export and Classics exclusion passed.');
}catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});await fs.writeFile(`${out}/failure.html`,await page.content());console.log({show,requests:requests.slice(-12),account:await page.locator('.account-menu').innerText()});throw error;}finally{await browser.close();}

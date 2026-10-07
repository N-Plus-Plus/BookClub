// Synthetic catalogue only. Run with Vite dev:ui and locally installed Playwright:
// corepack pnpm exec tsx tests/metrics.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture.ts';
const {chromium} = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined),headless:true});
const context = await browser.newContext({hasTouch:true});
const page = await context.newPage(),catalog = metricsFixture(),errors = [],requests = [];
page.on('pageerror',error => errors.push(error.message));
await context.addInitScript(() => localStorage.setItem('bookclub.dev-member','m1'));
let sparse = false;
const enriched = metricsEnrichmentFixture();
// Exercise full scrollable datasets beyond the old ten/twelve item limits.
for(const movie of Object.values(enriched.movies)) {
  movie.countries = [...movie.countries,...Array.from({length:14},(_,i)=>({code:`X${i}`,name:`Fixture country ${i}`}))];
  movie.companies = [...movie.companies,...Array.from({length:14},(_,i)=>({external_id:`fixture-${i}`,name:`Fixture studio ${i}`}))];
}
await context.route('**/api/v1/**',async route => {
  const path = new URL(route.request().url()).pathname;requests.push(path);
  assert.equal(route.request().method(),'GET');
  let data;
  if (path.endsWith('/health')) data = {status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
  else if (path.endsWith('/auth/me')) data = {viewer:{...catalog.members[0],role:'member'}};
  else if (path.endsWith('/rotation')) data = null;
  else if (path.endsWith('/metrics/enrichment')) data = sparse ? {movies:{}} : enriched;
  else if (path.endsWith('/catalog/compact')) {
    const movies = sparse ? catalog.movies.map(m => ({...m,year:null,runtime:null,director:null,genres:[],scores:[]})) : catalog.movies;
    data = {...catalog,movies,sessions:catalog.sessions.map(({movies,...s}) => ({...s,movie_ids:movies.map(m => m.id)}))};
  } else throw new Error(`Unexpected API read: ${path}`);
  await route.fulfill({json:{data}});
});
// All cached posters are absent: fallback is exercised without provider/CDN access.
await context.route('**/*',route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
await fs.mkdir('.verification/metrics',{recursive:true});
const columns = locator => locator.evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const results = [];
const tabs = ['Overview','Top / Bottom','Fingerprints','General Interest','Averages','Taste Diversity','Economics / Standalone','Extremes'];
const assignments = [['A'],['E','U','V','W'],['C','F','G','J'],['B','D','K','Y'],['M','N','T'],['O','P','Q','R','S'],['L','H','I'],['X']];
const tab = name => page.getByRole('tab',{name,exact:true}).click();
const active = () => page.locator('[role=tab][aria-selected=true]').textContent();
const check = async(width,label) => {
  assert(!(await overflow()),`${width}: ${label} page overflow`);
  assert(!/NaN|Infinity|undefined|0 \/ 0/.test(await page.locator('.metrics-content').textContent()));
  assert.equal(await page.getByRole('tabpanel').count(),1);
  const available = await page.locator('.metrics-content').evaluate(e=>e.clientWidth);
  for(const pair of await page.locator('.metrics-paired').all()) assert.equal(await columns(pair),available >= 720 ? 2 : 1);
};
try {
  for (const width of [320,390,720,1024,1600]) {
    requests.length = 0;
    await page.setViewportSize({width,height:900});
    if (width === 320) await page.goto('http://localhost:4173/#/metrics');
    else await page.reload();
    await page.getByRole('heading',{name:'Snapshot',exact:true}).waitFor();
    assert.equal(await active(),'Overview');
    assert.equal(await page.getByRole('tab').count(),8);
    assert.equal(await page.locator('.metrics-summary .stat strong').nth(1).textContent(),'14');
    const baseline = requests.length;
    const geometry = await page.evaluate(()=>{
      const filters=document.querySelector('.metrics-filters'),strip=document.querySelector('[role=tablist]');
      return {filters:filters.getBoundingClientRect().toJSON(),strip:strip.getBoundingClientRect().toJSON(),immediate:filters.nextElementSibling===strip,scrollable:strip.scrollWidth>strip.clientWidth};
    });
    assert(geometry.immediate && geometry.filters.bottom <= geometry.strip.y);
    if(width <= 720) assert(geometry.scrollable,'intrinsic width scrollable tabs');
    const found=[];
    for(let index=0;index<tabs.length;index++) {
      await tab(tabs[index]);
      await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});
      const codes=await page.getByRole('tabpanel').locator('[data-metric]').evaluateAll(elements=>elements.map(e=>e.dataset.metric));
      assert.deepEqual(codes.slice().sort(),assignments[index].slice().sort());found.push(...codes);
      const selected=page.locator('[role=tab][aria-selected=true]');
      const style=await selected.evaluate(e=>({height:e.getBoundingClientRect().height,border:getComputedStyle(e).borderBottomWidth,rect:e.getBoundingClientRect().toJSON(),strip:e.parentElement.getBoundingClientRect().toJSON()}));
      assert(style.height>=44 && parseFloat(style.border)>0,'touch target/active underline');
      assert(style.rect.x>=style.strip.x-1 && style.rect.right<=style.strip.right+1,'active tab fully visible');
      if(tabs[index]==='Economics / Standalone') assert(await selected.evaluate(e=>e.scrollWidth<=e.clientWidth),'long tab label readable');
      await check(width,tabs[index]);
      await page.screenshot({path:`.verification/metrics/tab-${index}-${width}.png`,fullPage:true});
      // Scroll every populated panel to review its last report as well.
      await page.getByRole('tabpanel').evaluate(e=>e.lastElementChild?.scrollIntoView({block:'end'}));
      await check(width,tabs[index]+' bottom');await page.evaluate(()=>scrollTo(0,0));
    }
    assert.equal(found.length,25);assert.equal(new Set(found).size,25);
    await tab('Top / Bottom');
    assert.match(await page.locator('.metrics-popularity-list').first().textContent(),/2,000,000 IMDb votes/);
    assert.match(await page.locator('.metrics-popularity-list').nth(1).textContent(),/12 IMDb votes/);
    for(const list of await page.locator('.metrics-popularity-list').all()) {
      assert(await list.evaluate(e=>[...e.querySelectorAll('.metrics-poster-film')].every(row=>{
        const style=getComputedStyle(row),rect=row.getBoundingClientRect(),parent=row.parentElement.getBoundingClientRect();
        return style.borderRadius==='0px' && style.borderBottomStyle==='solid' && parseFloat(style.borderBottomWidth)===1 && Math.abs(rect.width-parent.width)<1;
      })),'both popularity lists have full-width square dividers');
    }
    for(const footer of await page.locator('.metrics-film-footer').all()) {
      const g=await footer.evaluate(e=>({score:e.querySelector('strong').getBoundingClientRect().toJSON(),identity:e.lastElementChild.getBoundingClientRect().toJSON()}));
      assert(g.score.x<g.identity.x && g.score.y<g.identity.bottom && g.identity.y<g.score.bottom);
    }
    await tab('General Interest');
    assert.match(await page.locator('.metrics-decades').textContent(),/Unknown.*2.*14.3%/s);
    assert.equal(await page.locator('.metrics-classifications .metrics-stacked-profile').count(),5);
    assert.match(await page.locator('.metrics-classifications').textContent(),/MA15\+.*100.0%/s);
    const genreScroll=page.locator('.metrics-genre-scroll');
    assert(await genreScroll.evaluate(e=>{
      const rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
      return [...e.querySelectorAll('tr')].every(row=>parseFloat(getComputedStyle(row.firstElementChild).paddingLeft)===rem && parseFloat(getComputedStyle(row.lastElementChild).paddingRight)===rem);
    }),'outer header/body columns have 1rem inset');
    assert(await genreScroll.locator('tr > :nth-child(2), tr > :nth-child(3)').evaluateAll(cells=>cells.every(cell=>getComputedStyle(cell).paddingLeft==='3px' && getComputedStyle(cell).paddingRight==='3px')),'middle-column spacing unchanged');
    const headerBefore=await genreScroll.locator('thead').boundingBox();
    await genreScroll.evaluate(e=>e.scrollTop=120);
    const headerAfter=await genreScroll.locator('thead').boundingBox();
    assert(Math.abs(headerAfter.y-headerBefore.y)<=1,'sticky table header stays in place');
    await genreScroll.evaluate(e=>e.scrollTop=0);
    assert.equal(await genreScroll.evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('tbody tr')].filter(tr=>tr.getBoundingClientRect().bottom<=r.bottom+1).length;}),5);
    assert(await genreScroll.evaluate(e=>e.scrollHeight>e.clientHeight));await genreScroll.evaluate(e=>e.scrollTop=e.scrollHeight);assert(await genreScroll.evaluate(e=>e.scrollTop>0));
    await tab('Averages');
    for(const glyphs of await page.locator('.metrics-rating-circles').all()) assert.equal(await glyphs.getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.metrics-rating-profile > div').count(),9);assert.match(await page.locator('.metrics-rating-profile').textContent(),/Ebert.*87.5/s);
    await tab('Extremes');assert(await page.locator('.metrics-extremes .poster-empty').count()>=4);
    const available=await page.locator('.metrics-content').evaluate(e=>e.clientWidth);assert.equal(await columns(page.locator('.metrics-extremes')),available>=540 ? 2 : 1);
    for(let i=1;i<=5;i++) {
      await tab('Fingerprints');await page.locator('.metrics-filters button').nth(i).click();
      assert.equal(await active(),'Fingerprints');assert.equal(await page.locator('.metrics-theme-signature').count(),0);assert.equal(await page.locator('.metrics-signature').count(),0);
      assert(await page.locator('.metrics-fingerprint .metrics-distribution-row').count()<=5);
      for(const name of tabs) {await tab(name);await check(width,`${name} identity ${i}`);}
      await tab('Overview');assert.equal(await page.locator('.metrics-summary .stat strong').nth(1).textContent(),String([3,2,6,1,2][i-1]));
      await tab('Economics / Standalone');assert.equal(await page.locator('.metrics-languages .metrics-stacked-profile').count(),2);
      await tab('General Interest');assert.equal(await page.locator('.metrics-classifications .metrics-stacked-profile').count(),2);
      await tab('Averages');
    for(const glyphs of await page.locator('.metrics-rating-circles').all()) assert.equal(await glyphs.getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.metrics-median-budget .metrics-distribution-row').count(),2);
      await tab('Taste Diversity');assert.equal(await page.locator('.metrics-diversity section').count(),5);
    }
    await tab('Fingerprints');await page.locator('.metrics-filters button').nth(1).click();
    for(const role of ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer']) {await page.locator('.metrics-talent select').selectOption(role);assert.match(await page.locator('.metrics-talent').textContent(),new RegExp(`${role} known for 2 / 3 appearances`));}
    assert(await page.locator('.metrics-talent select').evaluate(e=>e.getBoundingClientRect().height)>=44);
    await tab('Fingerprints');await page.locator('.metrics-filters button').first().click();
    const studios=page.locator('.metrics-companies .metrics-five-scroll');
    assert(await studios.locator('.metrics-enriched-row').count()>12);
    assert(await studios.evaluate(e=>e.scrollHeight>e.clientHeight));
    await studios.evaluate(e=>e.scrollTop=e.scrollHeight);assert(await studios.evaluate(e=>e.scrollTop>0));
    await tab('Economics / Standalone');
    const countries=page.locator('.metrics-countries .metrics-five-scroll');
    assert(await countries.locator('.metrics-enriched-row').count()>12);
    assert(await countries.evaluate(e=>e.scrollHeight>e.clientHeight));
    await countries.evaluate(e=>e.scrollTop=e.scrollHeight);assert(await countries.evaluate(e=>e.scrollTop>0));
    assert.equal(await page.locator('.metrics-scatter').count(),0);assert.match(await page.locator('.metrics-revenue-ratios').textContent(),/7 \/ 10 unique films/);
    assert.match(await page.locator('.metrics-revenue-ratios a').first().getAttribute('href'),/^#\/movie\//);
    await tab('Top / Bottom');
    const modes=page.locator('.metrics-score-filters').first();
    assert.equal(await modes.locator('button').count(),9);
    assert(await modes.evaluate(e=>{const buttons=[...e.querySelectorAll('button')],active=buttons.find(b=>b.getAttribute('aria-pressed')==='true'),style=getComputedStyle(active);return buttons.every(b=>b.offsetTop===buttons[0].offsetTop) && style.borderBottomStyle==='solid' && parseFloat(style.borderBottomWidth)>0 && style.borderRadius==='0px';}));
    await page.getByRole('group',{name:'Top 5 score filter'}).getByRole('button',{name:'Roger Ebert',exact:true}).click();assert.match(await page.locator('.metrics-rankings section').first().textContent(),/3.5 \/ 4/);
    await page.evaluate(()=>scrollTo(0,0));
    const before=await page.evaluate(()=>scrollY);await tab('Fingerprints');assert.equal(await page.evaluate(()=>scrollY),before,'tab click does not move page');
    const selected=page.getByRole('tab',{name:'Fingerprints',exact:true});await selected.focus();await page.keyboard.press('ArrowRight');assert.equal(await active(),'General Interest');
    assert(await page.locator('[role=tab][aria-selected=true]').evaluate(e=>e===document.activeElement && getComputedStyle(e).outlineStyle!=='none'),'visible keyboard focus');
    await page.keyboard.press('End');assert.equal(await active(),'Extremes');await page.keyboard.press('Home');assert.equal(await active(),'Overview');
    assert.equal(requests.length,baseline,'tab/identity/role/score changes generate no API reads');assert.equal(requests.filter(p=>p.endsWith('/metrics/enrichment')).length,1);
    results.push({width,available,overflow:false,filterCalls:requests.length-baseline,tabs:8});
  }
  sparse=true;await page.setViewportSize({width:390,height:900});await page.reload();await page.getByRole('heading',{name:'Snapshot',exact:true}).waitFor();assert.equal(await active(),'Overview');await page.locator('.metrics-filters button').nth(1).click();
  for(const name of tabs) {await tab(name);await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});await check(390,name+' sparse');await page.screenshot({path:`.verification/metrics/sparse-${tabs.indexOf(name)}-390.png`,fullPage:true});}
  await tab('Economics / Standalone');assert.match(await page.locator('.metrics-languages').textContent(),/Unknown.*100.0%/s);
  assert.deepEqual(errors,[]);await fs.writeFile('.verification/metrics/results.json',JSON.stringify({results,partialData:true,errors},null,2));console.log(JSON.stringify({results,partialData:true,errors}));
} finally {await browser.close();}

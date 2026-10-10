import { metricsInventory } from './helpers/metrics-inventory.ts';
// Synthetic catalogue only. Run with Vite dev:ui and locally installed Playwright:
// corepack pnpm exec tsx tests/metrics.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture, metricsFilm, metricsEvent, observation } from './metrics-fixture.ts';
import { emptyEnrichmentMovie } from '../shared/metrics-enrichment.ts';
import { metricsEnrichmentFixture } from './metrics-enrichment-fixture.ts';
const {chromium} = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined),headless:true});
const context = await browser.newContext({hasTouch:true});
const page = await context.newPage(),catalog = metricsFixture(),errors = [],requests = [];
page.on('pageerror',error => errors.push(error.message));
await context.addInitScript(() => localStorage.setItem('bookclub.dev-member','m1'));
let sparse = false,failEnrichment=false;
const enriched = metricsEnrichmentFixture();
// Exercise full scrollable datasets beyond the old ten/twelve item limits.
for(const movie of Object.values(enriched.movies)) {
  movie.countries = [...movie.countries,...Array.from({length:14},(_,i)=>({code:`X${i}`,name:`Fixture country ${i}`}))];
  movie.companies = [...movie.companies,...Array.from({length:24},(_,i)=>({external_id:`fixture-${i}`,name:`Fixture studio ${i}`}))];
}
await context.route('**/api/v1/**',async route => {
  const path = new URL(route.request().url()).pathname;requests.push(path);
  assert.equal(route.request().method(),'GET');
  let data;
  if (path.endsWith('/health')) data = {status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
  else if (path.endsWith('/auth/me')) data = {viewer:{...catalog.members[0],role:'member'}};
  else if (path.endsWith('/rotation')) data = null;
  else if (path.endsWith('/metrics/enrichment')) {if(failEnrichment)return route.fulfill({status:503,json:{error:{code:'UNAVAILABLE',message:'Synthetic enrichment unavailable'}}});data = sparse ? {movies:{}} : enriched;}
  else if (path.endsWith('/catalog/compact')) {
    const movies = sparse ? catalog.movies.map(m => ({...m,year:null,runtime:null,director:null,genres:[],scores:[]})) : catalog.movies;
    data = {...catalog,movies,sessions:catalog.sessions.map(({movies,...s}) => ({...s,movie_ids:movies.map(m => m.id)}))};
  } else throw new Error(`Unexpected API read: ${path}`);
  await route.fulfill({json:{data}});
});
// Artwork remains synthetic; external/provider traffic is blocked.
await context.route('**/*',route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
await fs.mkdir('.verification/metrics',{recursive:true});
const columns = locator => locator.evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const results = [];
const presentationOnly=process.env.BOOKCLUB_METRICS_PRESENTATION_ONLY==='1';
const tabs = ['Top 5','Tastes','Breakdowns','Records'];
const assignments = [['U','V','W','genre-combinations','G','L','H','I'],['C','F','S','R','P','O'],['B','T','K','Y','D','M','N'],['X']];
const tab = name => page.getByRole('tab',{name,exact:true}).click();
const active = () => page.locator('[role=tab][aria-selected=true]').textContent();
const check = async(width,label) => {
  if(await overflow())console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,20).map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON()}))));
  assert(!(await overflow()),`${width}: ${label} page overflow`);
  assert(!/NaN|Infinity|undefined|0 \/ 0/.test(await page.locator('.metrics-content').textContent()));
  assert.equal(await page.getByRole('tabpanel').count(),1);
  const available = await page.locator('.metrics-content').evaluate(e=>e.clientWidth);
  for(const pair of await page.locator('.metrics-paired').all()) assert.equal(await columns(pair),available >= 720 ? 2 : 1);
};
try {
  if(presentationOnly)await page.goto('http://localhost:4173/#/metrics');
  for (const width of presentationOnly?[]:[320,390,720,951,1440]) {
    requests.length = 0;
    await page.setViewportSize({width,height:900});
    const enrichmentRead = page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/metrics/enrichment'));
    if (width === 320) await page.goto('http://localhost:4173/#/metrics');
    else await page.reload();
    await page.getByRole('heading',{name:'Top 5 highest critic scores',exact:true}).waitFor();
    assert.equal(await active(),'Top 5');
    assert.equal(await page.getByRole('tab').count(),4);
    await enrichmentRead;
    const baseline = requests.length;
    const geometry = await page.evaluate(()=>{
      const filters=document.querySelector('.metrics-filters'),strip=document.querySelector('[role=tablist]');
      return {filters:filters.getBoundingClientRect().toJSON(),strip:strip.getBoundingClientRect().toJSON(),immediate:filters.nextElementSibling===strip,scrollable:strip.scrollWidth>strip.clientWidth};
    });
    assert(geometry.immediate && geometry.filters.bottom <= geometry.strip.y);
    assert(await page.locator('[role=tablist]').evaluate(e=>getComputedStyle(e).flexWrap==='nowrap'),'tabs retain intrinsic non-wrapping strip');
    const found=[];
    for(let index=0;index<tabs.length;index++) {
      await tab(tabs[index]);
      await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});
      assert.deepEqual(await page.locator('.metrics-panel h2,.metrics-panel h3').evaluateAll(es=>es.filter(e=>e.textContent!=='Records'&&(e.tagName==='H2'||!e.closest('.staging-report'))).map(e=>e.textContent)),metricsInventory[tabs[index]]);
      const codes=await page.getByRole('tabpanel').locator('[data-metric]').evaluateAll(elements=>elements.map(e=>e.dataset.metric));
      assert.deepEqual(codes.slice().sort(),assignments[index].slice().sort());found.push(...codes);
      if(tabs[index]==='Breakdowns') {

        assert.equal(await page.locator('.metrics-classification-row').count(),5);
        assert.equal(await page.locator('.metrics-classifications .metrics-stack-legend').count(),1);
        assert.equal(await page.locator('.metrics-economics-axis').count(),1);
        assert.equal(await page.locator('.metrics-economics-row').count(),5);
        assert(!/appearances/.test(await page.locator('.metrics-classifications').textContent()));
        for(const stack of await page.locator('.metrics-classification-row .metrics-stack-bar').all()) assert(Math.abs(await stack.locator(':scope > span').evaluateAll(segments=>segments.reduce((sum,e)=>sum+parseFloat(e.style.width),0))-100)<0.001);
      }
      if(tabs[index]==='Tastes') {
        assert.deepEqual(codes,assignments[index]);
        assert.deepEqual(await page.locator('[data-metric] h3').allTextContents(),['Genre fingerprint','Theme fingerprint','Recurring cast','Directors','Original languages','Production countries']);
        assert(!/appearances|%/.test(await page.locator('.metrics-fingerprint').textContent()));
        assert.deepEqual(await page.locator('.metrics-comparison-bars small').allTextContents(),Array.from({length:5},()=>['Brought','vs. Club']).flat());
        assert.deepEqual(await page.locator('.metrics-signature .metrics-enriched-row').evaluateAll(rows=>rows.map(e=>e.style.getPropertyValue('--chart-colour'))),['var(--jeans)','var(--lavender)','var(--jeans)','var(--lavender)','var(--jeans)']);
        assert.equal(await page.locator('.metrics-themes > .meta').textContent(),'Recurring themes that distinguish each boob from the rest of the club.');
        assert.equal(await page.locator('.metrics-diversity.metrics-section').count(),0);
        for(const cloud of await page.locator('.metrics-theme-cloud').all()) assert((await cloud.locator('li').count())<=12);
      }
      const selected=page.locator('[role=tab][aria-selected=true]');
      const style=await selected.evaluate(e=>({height:e.getBoundingClientRect().height,border:getComputedStyle(e,'::after').height,rect:e.getBoundingClientRect().toJSON(),strip:e.parentElement.getBoundingClientRect().toJSON()}));
      assert(style.height>=44 && parseFloat(style.border)>0,'touch target/active underline');
      assert(!/\b(?:Fingerprints|Outliers|Diversity|General|Averages|Standalone|Cabinet|Extremes Cabinet)\b/.test(await page.locator('.metrics-content').textContent()),'no superseded navigation names remain visible');
      if(tabs[index]==='Records')assert.equal(await page.locator('[data-metric="X"] h2').textContent(),'Records');
      assert.equal(await page.locator('.metrics-category-tabs svg').count(),0);assert(await selected.evaluate(e=>{const style=getComputedStyle(e,'::after');return style.left==='8px' && style.right==='8px' && getComputedStyle(e).borderRadius==='0px';}),'Classics inset underline without icons');
      assert(style.rect.x>=style.strip.x-1 && style.rect.right<=style.strip.right+1,'active tab fully visible');
      await check(width,tabs[index]);
      await page.screenshot({path:`.verification/metrics/tab-${index}-${width}.png`,fullPage:true});
      // Scroll every populated panel to review its last report as well.
      await page.getByRole('tabpanel').evaluate(e=>e.lastElementChild?.scrollIntoView({block:'end'}));
      await check(width,tabs[index]+' bottom');await page.evaluate(()=>scrollTo(0,0));
    }
    assert.equal(found.length,22);assert.equal(new Set(found).size,22);
    await tab('Top 5');
    assert.match(await page.locator('.metrics-popularity-list').first().textContent(),/2,000,000 IMDb votes/);
    assert.match(await page.locator('.metrics-popularity-list').nth(1).textContent(),/12 IMDb votes/);
    for(const list of await page.locator('.metrics-popularity-list').all()) {
      assert(await list.evaluate(e=>[...e.querySelectorAll('.metrics-film-item')].every(row=>{
        const style=getComputedStyle(row),rect=row.getBoundingClientRect(),parent=row.parentElement.getBoundingClientRect();
        return style.borderRadius==='0px' && getComputedStyle(row.parentElement).borderBottomStyle==='solid' && parseFloat(getComputedStyle(row.parentElement).borderBottomWidth)===1 && Math.abs(rect.width-parent.width)<1;
      })),'both popularity lists have full-width square dividers');
    }
    const rankingColumns=await columns(page.locator('.metrics-rankings'));
    const contentWidth=await page.locator('.metrics-content').evaluate(e=>e.clientWidth);
    assert.equal(rankingColumns,contentWidth>=720?2:1);
    for(const row of await page.locator('.metrics-film-item').all()) {
      const g=await row.evaluate(e=>{
        const [poster,copy,host]=e.children,rect=e.getBoundingClientRect();
        return {rect:rect.toJSON(),poster:poster.getBoundingClientRect().toJSON(),copy:copy.getBoundingClientRect().toJSON(),host:host.getBoundingClientRect().toJSON(),title:copy.firstElementChild.getBoundingClientRect().toJSON(),overflow:e.scrollWidth>e.clientWidth,posterOverflow:poster.scrollWidth>poster.clientWidth,hostOverflow:host.scrollWidth>host.clientWidth,columns:getComputedStyle(e).gridTemplateColumns,border:getComputedStyle(e.parentElement).borderBottomWidth,link:e.getAttribute('href'),label:e.getAttribute('aria-label'),titleText:copy.firstElementChild.textContent};
      });
      assert(!g.overflow && !g.hostOverflow && !g.posterOverflow,`${width}: film row overflow`);
      assert(g.poster.right<=g.copy.x && g.copy.right<=g.host.x,`${width}: distinct poster/information/identity columns`);
      assert(g.title.right<=g.host.x && Math.abs(g.title.y-g.host.y)<1,'title stays in information column beside identity');
      assert.equal(g.poster.width,64);assert.equal(g.poster.height,96);
      assert.equal(g.border,'1px');assert.match(g.link,/^#\/movie\//);assert.equal(g.label,g.titleText);
    }
    assert(await page.locator('[data-metric="W"]').evaluate(e=>getComputedStyle(e).borderTopWidth==='0px'),'single row boundary without following group border');
    assert.equal(await page.locator('.metrics-film-footer').count(),0);
    const medians=await page.locator('[data-metric="W"]').textContent();
    assert.match(medians,/Median .* IMDb votes · Median .* total audience votes/);
    await page.getByRole('group',{name:'Most popular vote filter'}).getByRole('button',{name:'All audiences',exact:true}).click();
    assert.match(await page.locator('.metrics-popularity-list').first().textContent(),/audience votes/);
    assert.match(await page.locator('.metrics-popularity-list').nth(1).textContent(),/IMDb votes/);
    await page.getByRole('group',{name:'Most obscure vote filter'}).getByRole('button',{name:'All audiences',exact:true}).click();
    assert.match(await page.locator('.metrics-popularity-list').nth(1).textContent(),/audience votes/);
    await page.getByRole('group',{name:'Most obscure vote filter'}).getByRole('button',{name:'IMDb',exact:true}).click();
    assert.equal(await page.locator('[data-metric="W"]').textContent(),medians);
    await page.getByRole('group',{name:'Most popular vote filter'}).getByRole('button',{name:'IMDb',exact:true}).click();
    await tab('Breakdowns');
    assert.match(await page.locator('.metrics-decades').textContent(),/Unknown.*14.3%/s);
    assert.equal(await page.locator('.metrics-classification-row').count(),5);
    assert.match(await page.locator('.metrics-classifications').textContent(),/MA15\+.*100.0%/s);
    const genreScroll=page.locator('.metrics-genre-scroll');
    assert(await genreScroll.evaluate(e=>{
      const rem=parseFloat(getComputedStyle(document.documentElement).fontSize);
      return [...e.querySelectorAll('tr')].every(row=>parseFloat(getComputedStyle(row.firstElementChild).paddingLeft)===rem && parseFloat(getComputedStyle(row.lastElementChild).paddingRight)===rem);
    }),'outer header/body columns have 1rem inset');
    assert(await genreScroll.locator('tr > :nth-child(2), tr > :nth-child(3)').evaluateAll(cells=>cells.every(cell=>getComputedStyle(cell).paddingLeft==='4px' && getComputedStyle(cell).paddingRight==='16px')),'middle-column spacing unchanged');
    const headerBefore=await genreScroll.locator('thead').boundingBox();
    await genreScroll.evaluate(e=>e.scrollTop=120);
    const headerAfter=await genreScroll.locator('thead').boundingBox();
    assert(Math.abs(headerAfter.y-headerBefore.y)<=1,'sticky table header stays in place');
    await genreScroll.evaluate(e=>e.scrollTop=0);
    assert.equal(await genreScroll.evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('tbody tr')].filter(tr=>tr.getBoundingClientRect().bottom<=r.bottom+1).length;}),5);
    assert(await genreScroll.evaluate(e=>e.scrollHeight>e.clientHeight));await genreScroll.evaluate(e=>e.scrollTop=e.scrollHeight);assert(await genreScroll.evaluate(e=>e.scrollTop>0));
    await tab('Breakdowns');
    for(const glyphs of await page.locator('.metrics-rating-circles').all()) assert.equal(await glyphs.getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.metrics-rating-profile > div').count(),9);assert.match(await page.locator('.metrics-rating-profile').textContent(),/Ebert.*87.5/s);
    await tab('Records');assert(await page.locator('.metrics-extremes .poster-empty').count()>=4);
    const available=await page.locator('.metrics-content').evaluate(e=>e.clientWidth);assert.equal(await columns(page.locator('.metrics-extremes')),available>=540 ? 2 : 1);
    for(let i=1;i<=5;i++) {
      await tab('Tastes');await page.locator('.metrics-filters button').nth(i).click();
      assert.equal(await active(),'Tastes');assert.equal(await page.locator('.metrics-theme-signature').count(),0);assert.equal(await page.locator('.metrics-signature').count(),0);
      assert(await page.locator('.metrics-fingerprint .metrics-distribution-row').count()<=5);
      for(const name of tabs) {await tab(name);await check(width,`${name} identity ${i}`);}
      await tab('Breakdowns');assert.equal(await page.locator('.metrics-classification-row').count(),1);
      await tab('Breakdowns');
    for(const glyphs of await page.locator('.metrics-rating-circles').all()) assert.equal(await glyphs.getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.metrics-median-budget').count(),1);
      await tab('Tastes');assert.equal(await page.locator('.metrics-diversity section').count(),4);
    }
    await tab('Top 5');await page.locator('.metrics-filters button').nth(1).click();
    for(const role of ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer']) {await page.locator('.metrics-talent select').selectOption(role);assert.doesNotMatch(await page.locator('.metrics-talent').textContent(),/known for/);}
    assert(await page.locator('.metrics-talent select').evaluate(e=>e.getBoundingClientRect().height)>=44);
    await tab('Top 5');await page.locator('.metrics-filters button').first().click();
    await page.locator('.metrics-talent select').selectOption('Studios');
    const studios=page.locator('.metrics-talent');
    assert.equal(await studios.locator('.metrics-frequency-row').count(),20);
    assert.match(await studios.textContent(),/26 results/,'every fifth-place studio tie remains available');
    await studios.getByRole('button',{name:'Next',exact:true}).click();
    assert.equal(await studios.locator('.metrics-frequency-row').count(),6);
    assert(await studios.locator('.metrics-frequency-row').evaluateAll(rows=>rows.every(e=>e.textContent.includes('12 appearances · 85.7%'))));
    await studios.getByRole('button',{name:'Previous',exact:true}).click();
    const countries=page.locator('.metrics-countries');
    assert.equal(await countries.locator('.metrics-enriched-row').count(),16);
    assert(await countries.locator('.metrics-enriched-row').evaluateAll(rows=>rows.every(e=>e.textContent.includes('9 films') && !e.textContent.includes('%'))),'unique-film country denominator includes the missing-country film');
    assert.equal(await page.locator('.metrics-companies').count(),0);
    assert.equal(await countries.locator('.metrics-distribution-track').count(),16);
    const headingTexts=await page.locator('.metrics-panel h2,.metrics-panel h3').evaluateAll(es=>es.filter(e=>e.tagName==='H2'||!e.closest('.staging-report')).map(e=>e.textContent));
    assert.deepEqual(headingTexts,metricsInventory['Top 5']);
    assert.match(await page.locator('.metrics-revenue-ratios a').first().getAttribute('href'),/^#\/movie\//);
    const ratios=await page.locator('.metrics-ratio-data > p').allTextContents();assert(ratios.every(text=>/ · Ratio: (?:[\d,]+ : 1|1 : [\d,]+)$/.test(text)));
    const partnership=page.locator('[aria-label="Creative partnerships"] select');assert.equal(await partnership.inputValue(),'Writer');await partnership.selectOption('Editor');assert.equal(await page.locator('[aria-label="Creative partnerships"] section').count(),1);
    const modes=page.locator('.metrics-score-filters').first();
    assert.equal(await modes.locator('button').count(),2);
    assert(await modes.evaluate(e=>{const buttons=[...e.querySelectorAll('button')],active=buttons.find(b=>b.getAttribute('aria-pressed')==='true'),style=getComputedStyle(active);return buttons.every(b=>b.offsetTop===buttons[0].offsetTop) && parseFloat(getComputedStyle(active,'::after').height)>0 && style.borderRadius==='0px';}));
    await page.getByRole('group',{name:'Top 5 score filter'}).getByRole('button',{name:'Audience',exact:true}).click();assert.match(await page.locator('.metrics-rankings section').first().textContent(),/\/ 100/);
    await page.evaluate(()=>scrollTo(0,0));
    const before=await page.evaluate(()=>scrollY);await tab('Tastes');assert.equal(await page.evaluate(()=>scrollY),before,'tab click does not move page');
    const selected=page.getByRole('tab',{name:'Tastes',exact:true});await selected.focus();await page.keyboard.press('ArrowRight');assert.equal(await active(),'Breakdowns');
    assert(await page.locator('[role=tab][aria-selected=true]').evaluate(e=>e===document.activeElement && getComputedStyle(e).outlineStyle!=='none'),'visible keyboard focus');
    await page.keyboard.press('End');assert.equal(await active(),'Records');await page.keyboard.press('Home');assert.equal(await active(),'Top 5');
    assert.equal(await partnership.inputValue(),'Editor');assert.equal(await page.locator('.metrics-talent select').inputValue(),'Studios');
    assert.equal(requests.length,baseline,'tab/identity/role/score changes generate no API reads');assert.equal(requests.filter(p=>p.endsWith('/metrics/enrichment')).length,1);
    results.push({width,available,overflow:false,filterCalls:requests.length-baseline,tabs:tabs.length});
  }
  // Adversarial Top 5 rows: long identities, cycle context, real/failed artwork and unequal vote measures.
  catalog.members[0].display_name='A member with a deliberately long display name';
  catalog.cycles=[{id:'fixture-cycle',ordinal:12,title:null,rough_date:'2026-01-01',import_source:null,import_key:null,created_at:'',updated_at:''}];
  catalog.sessions=catalog.sessions.map(session=>({...session,cycle_id:'fixture-cycle'}));
  catalog.movies[0].assets=[{asset_type:'poster',provider:'fixture',reference:'/fixture-poster.svg',width:64,height:96,preferred:1}];
  catalog.movies[1].assets=[{asset_type:'poster',provider:'fixture',reference:'/failed-poster.jpg',width:64,height:96,preferred:1}];
  catalog.movies[1].scores.push(observation('letterboxd','rating',8,10,3000000));
  await context.route('**/fixture-poster.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="96"><rect width="64" height="96" fill="#7b1c3a"/><circle cx="32" cy="40" r="20" fill="#d6cba8"/></svg>'}));
  await context.route('**/failed-poster.jpg',route=>route.fulfill({status:404,body:''}));
  for(const width of presentationOnly?[]:[320,390,720,951,1440]) {
    await page.setViewportSize({width,height:900});await page.reload();
    await page.getByRole('heading',{name:'Top 5 highest critic scores',exact:true}).waitFor();
    await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});
    const rows=page.locator('.metrics-film-item');
    for(const row of await rows.all()) {
      assert(await row.evaluate(e=>{
        const [poster,copy,host]=e.children,p=poster.getBoundingClientRect(),c=copy.getBoundingClientRect(),h=host.getBoundingClientRect();
        return e.scrollWidth<=e.clientWidth && host.scrollWidth<=host.clientWidth && p.right<=c.x && c.right<=h.x && [...copy.children].every(child=>child.getBoundingClientRect().right<=h.x) && copy.textContent.includes('Cycle 12 · Film');
      }),`${width}: adversarial row contains poster, text, context and long identity without overlap`);
    }
    await page.getByRole('group',{name:'Top 5 score filter'}).getByRole('button',{name:'Audience',exact:true}).click();
    assert.match(await page.locator('[data-metric="U"] h2').textContent(),/audience/);
    assert.match(await page.locator('[data-metric="V"] h2').textContent(),/critic/);
    await page.getByRole('group',{name:'Bottom 5 score filter'}).getByRole('button',{name:'Audience',exact:true}).click();
    const summary=await page.locator('[data-metric="W"]').textContent();
    assert.notEqual(summary.split(' · ')[0].replace('IMDb',''),summary.split(' · ')[1].replace('total audience',''));
    const popularityFilter=page.getByRole('group',{name:'Most popular vote filter'});
    const options=await popularityFilter.getByRole('button').evaluateAll(buttons=>buttons.map(e=>e.getBoundingClientRect().width));
    assert(Math.abs(options[0]-options[1])<=1,'balanced two-option control');
    await popularityFilter.getByRole('button',{name:'IMDb',exact:true}).focus();await page.keyboard.press('Tab');await page.keyboard.press('Enter');
    assert.equal(await popularityFilter.getByRole('button',{name:'All audiences',exact:true}).getAttribute('aria-pressed'),'true');
    assert(await popularityFilter.getByRole('button',{name:'All audiences',exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle!=='none'),'visible keyboard focus');
    assert.match(await page.locator('.metrics-popularity-list').first().textContent(),/3,000,012 audience votes/);
    assert.equal(await page.locator('.metrics-popularity-list').first().locator('a').first().getAttribute('href'),'#/movie/b');
    assert.equal(await page.locator('[data-metric="W"]').textContent(),summary);
    assert(await rows.locator('img.poster').first().evaluate(e=>e.complete && e.naturalWidth===64),'synthetic poster rendered');
    await page.locator('.metrics-popularity-list').first().scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.metrics-popularity-list').first().locator('li').first().locator('.poster-empty').count(),1,'failed poster falls back');
    await check(width,'adversarial Top 5');
    await page.screenshot({path:`.verification/metrics/top-bottom-adversarial-${width}.png`,fullPage:true});
    if(width>=720) {
      await page.getByRole('button',{name:'Collapse navigation',exact:true}).click();
      const available=await page.locator('.metrics-content').evaluate(e=>e.clientWidth);
      assert.equal(await columns(page.locator('.metrics-rankings')),available>=720?2:1);
      for(const row of await page.locator('.metrics-film-item').all()) assert(await row.evaluate(e=>{
        const [,copy,host]=e.children,c=copy.getBoundingClientRect(),h=host.getBoundingClientRect();
        return e.scrollWidth<=e.clientWidth && host.scrollWidth<=host.clientWidth && c.right<=h.x && copy.firstElementChild.getBoundingClientRect().right<=h.x;
      }),`${width}: collapsed drawer row stability`);
      await check(width,'collapsed Top 5');
      const link=page.locator('.metrics-rankings a').first();await link.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
      assert(await link.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'),'accessible film link has visible focus');
      await page.screenshot({path:`.verification/metrics/top-bottom-collapsed-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Expand navigation',exact:true}).click();
    }
  }
  // General and language stress: tiny segments, long names, unequal finances, missing contributors.
  const originalCatalog=structuredClone(catalog),originalEnriched=structuredClone(enriched);
  const stressFilms=Array.from({length:100},(_,index)=>metricsFilm(`general-${index}`));
  Object.assign(catalog,{movies:stressFilms,sessions:[metricsEvent('general-sean',stressFilms),metricsEvent('general-troy',[stressFilms[0],stressFilms[1]],'m2'),metricsEvent('general-matt',[stressFilms[2]],'m3'),metricsEvent('general-jess',[],'m4'),metricsEvent('general-classics',[stressFilms[3]],null)]});
  enriched.movies=Object.fromEntries(stressFilms.map((film,index)=>[film.id,{...emptyEnrichmentMovie(),metadata:{original_language:index<70?'zz':'fr',budget:index===0?1000000:2000000,revenue:index===0?80000000:4000000},languages:[{code:'zz',name:'A deliberately long original-language display name that wraps within the report',english_name:'A deliberately long original-language display name that wraps within the report'}],contentRatings:index<80?[{certification:'G',release_type:3}]:index<85?[{certification:'PG',release_type:3}]:index<89?[{certification:'M',release_type:3}]:[]} ]));
  for(const width of presentationOnly?[]:[320,390,720,951,1440]) {
    await page.setViewportSize({width,height:900});await page.reload();await page.getByRole('heading',{name:'Top 5 highest critic scores',exact:true}).waitFor();await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});
    await tab('Breakdowns');await check(width,'General stress');
    const classifications=page.locator('.metrics-classification-row');assert.equal(await classifications.count(),5);
    assert.deepEqual(await classifications.first().locator('.metrics-segment-percentage').allTextContents(),['80.0%','5.0%','11.0%']);
    assert((await classifications.first().locator('[role=img]').getAttribute('aria-label')).includes('M 4.0%'));
    assert.equal(await classifications.nth(3).locator('[role=img]').count(),0);
    const fullWidths=await page.locator('.metrics-economics-row').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('.metrics-distribution-track span')].map(bar=>bar.style.width)));
    const axis=await page.locator('.metrics-economics-axis').getAttribute('aria-label');
    assert(await page.locator('.metrics-economics-chart').evaluate(e=>{
      const tracks=[...e.querySelectorAll('.metrics-distribution-track')].map(track=>track.getBoundingClientRect());
      const axis=e.querySelector('.metrics-economics-axis').getBoundingClientRect();
      return tracks.every(track=>Math.abs(track.x-axis.x)<1 && Math.abs(track.right-axis.right)<1);
    }),'every financial track and the shared axis align');
    await page.screenshot({path:`.verification/metrics/general-stress-${width}.png`,fullPage:true});
    await page.locator('.metrics-filters button').nth(2).click();
    assert.equal(await classifications.count(),1);assert.equal(await page.locator('.metrics-economics-row').count(),1);
    assert.equal(await page.locator('.metrics-economics-axis').getAttribute('aria-label'),axis);
    assert.deepEqual(await page.locator('.metrics-economics-row .metrics-distribution-track span').evaluateAll(bars=>bars.map(bar=>bar.style.width)),fullWidths[1]);
    await check(width,'General single contributor');await page.screenshot({path:`.verification/metrics/general-single-${width}.png`,fullPage:true});
    await tab('Top 5');await page.locator('.metrics-filters button').first().click();
    const languageRows=page.locator('.metrics-non-english .metrics-enriched-row');assert.equal(await languageRows.count(),2);
    assert.deepEqual(await languageRows.evaluateAll(rows=>rows.map(row=>row.style.getPropertyValue('--chart-colour'))),['var(--jeans)','var(--lavender)']);
    const languageWidths=await page.locator('.metrics-non-english .metrics-distribution-track span').evaluateAll(bars=>bars.map(bar=>parseFloat(bar.style.width)));
    assert.equal(languageWidths[0],100);assert(Math.abs(languageWidths[1]-30/70*100)<0.001);
    assert(await languageRows.first().textContent().then(text=>text.includes('A deliberately long')));
    await check(width,'long language ranking');await page.locator('.metrics-non-english').scrollIntoViewIfNeeded();await page.screenshot({path:`.verification/metrics/language-stress-${width}.png`,fullPage:true});
  }
  // Presentation stress across both drawer modes, real dialog focus, and paginated Records ties.
  const tiedFilms=Array.from({length:26},(_,i)=>metricsFilm(`reception-${i}`,{title:`A very long tied film title ${i} that wraps in the Records card`,scores:[observation('imdb','rating',8,10),observation('metacritic','critic',80,100)],classic:i===0,seen:i===0?catalog.members.map((m,index)=>({member_id:m.id,seen:index%2,updated_at:''})):[]}));
  catalog.movies=tiedFilms;catalog.sessions=[metricsEvent('reception-ties',tiedFilms)];
  for(const width of [320,390,720,951,1440]) {
    await page.setViewportSize({width,height:900});await page.reload();
    await page.getByRole('heading',{name:'Top 5 highest critic scores',exact:true}).waitFor();
    for(const collapsed of width>=720?[false,true]:[false]) {
      if(collapsed)await page.getByRole('button',{name:'Collapse navigation',exact:true}).click();
      await tab('Breakdowns');await check(width,'economics/glossary '+collapsed);
      assert(await page.locator('.metrics-budget-heading').evaluateAll(headers=>headers.every(e=>e.scrollWidth<=e.clientWidth && [...e.children].every(c=>c.getBoundingClientRect().right<=e.getBoundingClientRect().right+1))));
      const opener=page.locator('.metrics-ratings-heading button');await opener.click();
      const dialog=page.getByRole('dialog',{name:'Score abbreviations',exact:true});await dialog.waitFor();
      assert(await dialog.getByRole('row').filter({hasText:'Letterboxd'}).count()===1);
      assert.equal(await dialog.locator('tbody tr').count(),9);
      assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth));
      await page.screenshot({path:`.verification/metrics/glossary-${width}-${collapsed}.png`,fullPage:true});
      await page.keyboard.press('Escape');assert(await opener.evaluate(e=>e===document.activeElement));
      await tab('Records');await check(width,'poster Records '+collapsed);
      for(const section of await page.locator('.metrics-reception-record').all()) {
        assert.equal(await section.locator('.metrics-reception-film').count(),5);
        assert.equal(await section.locator('.poster-empty').count(),5);
        assert(await section.locator('.metrics-reception-film').evaluateAll(rows=>rows.every(e=>e.scrollWidth<=e.clientWidth && e.textContent.includes('Critics 80.0 · Audiences 80.0 / 100 · 0.0 points · Equal'))));
        for(let i=0;i<5;i++)await section.getByRole('button',{name:'Next',exact:true}).click();
        assert.equal(await section.locator('.metrics-reception-film').count(),1);
      }
      for(const section of await page.locator('.metrics-viewed-record').all()) {
        assert.equal(await section.locator('.metrics-viewed-row').count(),2);
        assert.doesNotMatch(await section.textContent(),/tied members|canonical Classic candidates/);
        assert(await section.locator('.metrics-viewed-row').evaluateAll(rows=>rows.every(e=>{const identity=e.firstElementChild.getBoundingClientRect(),count=e.lastElementChild.getBoundingClientRect();return identity.right<=count.x && e.scrollWidth<=e.clientWidth;})));
      }
      await page.screenshot({path:`.verification/metrics/records-stress-${width}-${collapsed}.png`,fullPage:true});
    }
  }
  Object.assign(catalog,originalCatalog);Object.assign(enriched,originalEnriched);
  failEnrichment=true;await page.setViewportSize({width:390,height:900});await page.reload();
  await page.getByRole('heading',{name:'Top 5 highest critic scores',exact:true}).waitFor();
  await page.getByRole('button',{name:'Retry enriched Metrics',exact:true}).waitFor();
  assert(await page.locator('.metrics-rankings a').count()>0,'enrichment failure retains genuine score reports');
  await page.screenshot({path:'.verification/metrics/top-five-enrichment-error-390.png',fullPage:true});
  failEnrichment=false;await page.getByRole('button',{name:'Retry enriched Metrics',exact:true}).click();
  await page.getByRole('button',{name:'Retry enriched Metrics',exact:true}).waitFor({state:'hidden'});
  await page.locator('.metrics-talent .metrics-frequency-row').first().waitFor();
  assert(await page.locator('.metrics-talent .metrics-frequency-row').count()>0,'retry restores moved Top 5 reports');
  sparse=true;await page.setViewportSize({width:390,height:900});await page.reload();await page.getByRole('heading',{name:'Top 5 highest critic scores',exact:true}).waitFor();assert.equal(await active(),'Top 5');await page.locator('.metrics-filters button').nth(1).click();
  for(const name of tabs) {await tab(name);await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});await check(390,name+' sparse');await page.screenshot({path:`.verification/metrics/sparse-${tabs.indexOf(name)}-390.png`,fullPage:true});}
  await tab('Breakdowns');assert.match(await page.locator('.metrics-classifications').textContent(),/100.0%/s);
  assert.deepEqual(errors,[]);await fs.writeFile('.verification/metrics/results.json',JSON.stringify({results,presentationWidths:[320,390,720,951,1440],topBottomAdversarialWidths:presentationOnly?[]:[320,390,720,951,1440],collapsedDrawerWidths:[720,951,1440],partialData:true,errors},null,2));console.log(JSON.stringify({results,presentationWidths:[320,390,720,951,1440],topBottomAdversarialWidths:presentationOnly?[]:[320,390,720,951,1440],collapsedDrawerWidths:[720,951,1440],partialData:true,errors}));
} finally {await browser.close();}

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
await context.route('**/api/v1/**',async route => {
  const path = new URL(route.request().url()).pathname;requests.push(path);
  assert.equal(route.request().method(),'GET');
  let data;
  if (path.endsWith('/health')) data = {status:'ok',environment:'local',authenticationRequired:false,googleAuthConfigured:false,demo:true};
  else if (path.endsWith('/auth/me')) data = {viewer:{...catalog.members[0],role:'member'}};
  else if (path.endsWith('/rotation')) data = null;
  else if (path.endsWith('/metrics/enrichment')) data = sparse ? {movies:{}} : metricsEnrichmentFixture();
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
try {
  for (const width of [320,390,720,1024,1600]) {
    await page.setViewportSize({width,height:900});
    await page.goto('http://localhost:4173/#/metrics');
    await page.getByRole('heading',{name:'Genre detail',exact:true}).waitFor();
    await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});
    assert.equal(requests.filter(path => path.endsWith('/metrics/enrichment')).length,1,'one lazy read during the mounted Metrics visit');
    await page.locator('.metrics-filters button').first().click();
    for (const direction of ['Top','Bottom']) await page.getByRole('group',{name:`${direction} 5 score filter`}).getByRole('button',{name:'IMDb',exact:true}).click();
    for (const footer of await page.locator('.metrics-film-footer').all()) {
      const geometry = await footer.evaluate(e => { const s=e.querySelector('strong').getBoundingClientRect(),i=e.lastElementChild.getBoundingClientRect();return {score:s.toJSON(),identity:i.toJSON()}; });
      assert(geometry.score.x < geometry.identity.x,`${width}: score precedes identity`);
      assert(geometry.score.y < geometry.identity.bottom && geometry.identity.y < geometry.score.bottom,`${width}: shared footer row`);
    }
    const scroll = page.locator('.metrics-genre-scroll');
    const rowsVisible = await scroll.evaluate(e => {const r=e.getBoundingClientRect();return [...e.querySelectorAll('tbody tr')].filter(tr=>tr.getBoundingClientRect().bottom<=r.bottom+1).length;});
    assert.equal(rowsVisible,5,`${width}: five full genres`);
    assert(await scroll.evaluate(e=>e.scrollHeight>e.clientHeight));
    await scroll.evaluate(e=>e.scrollTop=e.scrollHeight);
    assert(await scroll.evaluate(e=>e.scrollTop>0));
    await scroll.evaluate(e=>e.scrollTop=0);
    const baseline = requests.length;
    const signature = page.locator('.metrics-signature');
    assert.equal(await signature.count(),5);
    assert.match(await signature.first().textContent(),/SEAN.*Horror.*x club/s);
    assert.equal(await page.locator('.metrics-summary .stat strong').nth(1).textContent(),'14');
    assert.equal(await page.locator('.metrics-rating-profile > div').count(),9);
    assert.match(await page.locator('.metrics-decades').textContent(),/Unknown.*2.*14.3%/s);
    assert.match(await page.locator('.metrics-rating-profile').textContent(),/Ebert.*87.5/s);
    assert.match(await page.locator('.metrics-popularity-list').first().textContent(),/2,000,000 IMDb votes/);
    assert.match(await page.locator('.metrics-popularity-list').nth(1).textContent(),/12 IMDb votes/);
    assert(await page.locator('.metrics-extremes .poster-empty').count() === 4);
    assert.equal(await page.locator('.metrics-theme-signature').count(),5);
    assert.equal(await page.locator('.metrics-scatter a').count(),7);
    assert.match(await page.locator('.metrics-economics-scatter').textContent(),/7 \/ 10 unique films/);
    assert.equal(await page.locator('.metrics-classifications .metrics-stacked-profile').count(),5);
    assert.match(await page.locator('.metrics-classifications').textContent(),/MA15\+ 100.0%/);
    const available = await page.locator('.metrics-content').evaluate(e => e.clientWidth);
    assert.equal(await columns(page.locator('.metrics-extremes')),available >= 540 ? 2 : 1);
    for (const pair of await page.locator('.metrics-paired').all()) assert.equal(await columns(pair),available >= 720 ? 2 : 1);
    assert(!(await overflow()),`${width}: ALL page overflow`);
    await page.screenshot({path:`.verification/metrics/all-${width}.png`,fullPage:true});
    for (const [section,selector] of [['orientation','.metrics-filters'],['taste','.metrics-fingerprint'],['themes','.metrics-themes'],['talent','.metrics-talent'],['world','.metrics-countries'],['language','.metrics-languages'],['classification','.metrics-classifications'],['economics','.metrics-economics-scatter'],['diversity','.metrics-diversity'],['ratings','.metrics-rating-profile'],['rankings','.metrics-rankings'],['genres','.metrics-genre-scroll'],['extremes','.metrics-extremes']]) { await page.locator(selector).scrollIntoViewIfNeeded(); await page.screenshot({path:`.verification/metrics/${section}-${width}.png`}); }
    for (let i = 1;i <= 5;i++) {
      await page.locator('.metrics-filters button').nth(i).click();
      assert.equal(await signature.count(),0);
      assert.equal(await page.locator('.metrics-theme-signature').count(),0);
      assert.equal(await page.locator('.metrics-languages .metrics-stacked-profile').count(),2);
      assert.equal(await page.locator('.metrics-classifications .metrics-stacked-profile').count(),2);
      assert.equal(await page.locator('.metrics-median-budget .metrics-distribution-row').count(),2);
      const expected = [3,2,6,1,2][i-1];
      assert.equal(await page.locator('.metrics-summary .stat strong').nth(1).textContent(),String(expected));
      assert(await page.locator('.metrics-fingerprint .metrics-distribution-row').count() <= 5);
      if(i === 1) {
        assert.match(await page.locator('.metrics-directors').textContent(),/2 \/ 3 appearances/);
        assert.match(await page.locator('.metrics-rating-profile').textContent(),/Median 90 · 2 \/ 3 scored/);
        assert.equal(await page.locator('.metrics-popularity-list').first().locator('li').count(),1);
      }
      if(i === 3) assert.equal(await page.locator('.metrics-fingerprint .metrics-distribution-row').count(),5);
      assert(!(await overflow()),`${width}: identity ${i} overflow`);
      assert(!/NaN|Infinity|undefined|0 \/ 0/.test(await page.locator('.metrics-content').textContent()));
    }
    await page.locator('.metrics-filters button').nth(1).click();
    for (const role of ['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer']) {
      await page.locator('.metrics-talent select').selectOption(role);
      assert.match(await page.locator('.metrics-talent').textContent(),new RegExp(`${role} known for 2 / 3 appearances`));
    }
    await page.locator('.metrics-talent select').selectOption('Cast');
    assert(await page.locator('.metrics-talent select').evaluate(e => e.getBoundingClientRect().height) >= 44,'role selector touch target');
    await page.locator('.metrics-economics-scatter select').selectOption('');
    await page.mouse.move(0,0);
    await page.locator('.metrics-scatter').scrollIntoViewIfNeeded();
    const point = await page.locator('.metrics-scatter circle:not(.metrics-scatter-target)').first().boundingBox();
    await page.touchscreen.tap(point.x+point.width/2,point.y+point.height/2);
    assert(new URL(page.url()).hash === '#/metrics','first point tap inspects without navigating');
    assert.match(await page.locator('.metrics-scatter-detail').textContent(),/Budget.*Revenue.*SEAN/s);
    await page.locator('.metrics-scatter a').first().focus();
    assert.match(await page.locator('.metrics-scatter-detail').textContent(),/Budget.*Revenue.*SEAN/s);
    assert(!(await page.locator('.metrics-scatter').evaluate(e => /NaN|Infinity/.test(e.outerHTML))));
    assert(await page.locator('.metrics-scatter text').first().evaluate(e => e.getBoundingClientRect().height) >= 12,'scatter labels remain readable');
    await page.getByRole('group',{name:'Top 5 score filter'}).getByRole('button',{name:'Roger Ebert',exact:true}).click();
    assert.match(await page.locator('.metrics-rankings section').first().textContent(),/3.5 \/ 4/);
    assert.equal(requests.length,baseline,'filter/selector generated an API request');
    await page.screenshot({path:`.verification/metrics/filtered-${width}.png`,fullPage:true});
    results.push({width,available,overflow:false,filterCalls:requests.length-baseline});
  }
  sparse = true;
  await page.setViewportSize({width:390,height:900});await page.reload();
  await page.getByRole('heading',{name:'Genre detail',exact:true}).waitFor();
  await page.getByText('Loading enriched Metrics…',{exact:true}).waitFor({state:'hidden'});
  await page.locator('.metrics-filters button').nth(1).click();
  const text = await page.locator('.metrics-content').textContent();
  for (const message of ['No recognised genres for this selection.','No director data for this selection.','No IMDb vote data for this selection.','No data for this selection.']) assert(text.includes(message));
  assert.match(text,/Unknown.*3.*100.0%/s);assert(!/NaN|Infinity|undefined|0 \/ 0/.test(text));assert(!(await overflow()));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'.verification/metrics/sparse-390.png',fullPage:true});
  await fs.writeFile('.verification/metrics/results.json',JSON.stringify({results,partialData:true,errors},null,2));
  console.log(JSON.stringify({results,partialData:true,errors}));
} finally { await browser.close(); }

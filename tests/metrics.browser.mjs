// Synthetic catalogue only. Run with Vite dev:ui and locally installed Playwright:
// corepack pnpm exec tsx tests/metrics.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { metricsFixture } from './metrics-fixture.ts';
const {chromium} = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser = await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined),headless:true});
const context = await browser.newContext();
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
    const available = await page.locator('.metrics-content').evaluate(e => e.clientWidth);
    assert.equal(await columns(page.locator('.metrics-extremes')),available >= 540 ? 2 : 1);
    assert.equal(await columns(page.locator('.metrics-paired')),available >= 720 ? 2 : 1);
    assert(!(await overflow()),`${width}: ALL page overflow`);
    await page.screenshot({path:`.verification/metrics/all-${width}.png`,fullPage:true});
    for (const [section,selector] of [['orientation','.metrics-filters'],['taste','.metrics-fingerprint'],['ratings','.metrics-rating-profile'],['rankings','.metrics-rankings'],['genres','.metrics-genre-scroll'],['extremes','.metrics-extremes']]) { await page.locator(selector).scrollIntoViewIfNeeded(); await page.screenshot({path:`.verification/metrics/${section}-${width}.png`}); }
    for (let i = 1;i <= 5;i++) {
      await page.locator('.metrics-filters button').nth(i).click();
      assert.equal(await signature.count(),0);
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
    await page.getByRole('group',{name:'Top 5 score filter'}).getByRole('button',{name:'Roger Ebert',exact:true}).click();
    assert.match(await page.locator('.metrics-rankings section').first().textContent(),/3.5 \/ 4/);
    assert.equal(requests.length,baseline,'filter/selector generated an API request');
    await page.screenshot({path:`.verification/metrics/filtered-${width}.png`,fullPage:true});
    results.push({width,available,overflow:false,filterCalls:requests.length-baseline});
  }
  sparse = true;
  await page.setViewportSize({width:390,height:900});await page.reload();
  await page.getByRole('heading',{name:'Genre detail',exact:true}).waitFor();
  await page.locator('.metrics-filters button').nth(1).click();
  const text = await page.locator('.metrics-content').textContent();
  for (const message of ['No recognised genres for this selection.','No director data for this selection.','No IMDb vote data for this selection.','No data for this selection.']) assert(text.includes(message));
  assert.match(text,/Unknown.*3.*100.0%/s);assert(!/NaN|Infinity|undefined|0 \/ 0/.test(text));assert(!(await overflow()));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'.verification/metrics/sparse-390.png',fullPage:true});
  await fs.writeFile('.verification/metrics/results.json',JSON.stringify({results,partialData:true,errors},null,2));
  console.log(JSON.stringify({results,partialData:true,errors}));
} finally { await browser.close(); }

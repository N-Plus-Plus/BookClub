// Focused, synthetic Film Detail render; requires local Vite and optional Playwright.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.BOOKCLUB_BROWSER_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => console.error(error.message));
  await page.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
  await page.route('**/api/v1/**', route => route.abort());
  // Vite may serve imports with different HMR URLs; share one synthetic API object.
  await page.route(/\/frontend\/api\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: 'export const api = globalThis.__seenLayoutApi ??= {}; export class ApiClientError extends Error {}' }));
  await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: `
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    const { createRoot } = ReactDOM;
    import '/node_modules/@fontsource/lexend-deca/300.css';
    import '/node_modules/@fontsource/lexend-deca/400.css';
    import '/node_modules/@fontsource/lexend-deca/600.css';
    import '/style.css';
    import '/frontend/app.css';
    import { DetailScreen } from '/frontend/DetailScreen.tsx';
    import { api } from '/frontend/api.ts';
    import { rankMovie } from '/shared/ranking.ts';
    const members = ['Sean','Troy','Matt','Jess'].map((display_name,i) => ({id:'m'+i,display_name,sort_order:i,active:1,avatar:i+1}));
    const root = createRoot(document.getElementById('root'));
    const movies = new Map();
    api.detail = async id => movies.get(id);
    window.renderPopulation = left => {
      const movie = {id:'layout-'+left,title:'Film Detail layout fixture',original_title:null,year:1982,runtime:93,release_date:null,director:'Fixture director',genres:['Drama'],overview:'Synthetic Film Detail content for responsive Seen-state verification.',assets:[],external_ids:[],classic:true,scores:[],ranking:null,appearances:[],seen:members.map((m,i) => ({member_id:m.id,seen:i < left ? 0 : 1,updated_at:''}))};
      movie.ranking = rankMovie(movie.scores,movie.seen,members);
      movies.set(movie.id,movie);
      root.render(React.createElement('main',{className:'bookclub-shell','data-population':left},React.createElement(DetailScreen,{key:movie.id,id:movie.id,members})));
    };
    window.renderPopulation(0);
  ` }));
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(() => Boolean(window.renderPopulation));
  await fs.mkdir('.verification/seen-layout',{recursive:true});
  const results = [];
  for (const width of [1024,951,900,600,390,320,280]) {
    await page.setViewportSize({width,height:900});
    for (const left of [0,1,2,3,4]) {
      await page.evaluate(left => window.renderPopulation(left),left);
      await page.waitForFunction(left => document.querySelector('main')?.dataset.population === String(left) && document.querySelectorAll('.detail-seen-column')[0]?.querySelectorAll('.club-identity').length === left,left);
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const rect = el => {const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};};
        const summary = document.querySelector('.detail-seen-summary');
        const columns = [...summary.children];
        const sides = columns.map(column => {
          const heading = column.querySelector('h3');
          const bundle = column.querySelector('.detail-seen-members');
          if (getComputedStyle(heading).whiteSpace !== 'nowrap') throw Error('Heading minimum width lost');
          const items = [...bundle.children].map(rect);
          const probe = column.cloneNode(true);
          Object.assign(probe.style,{position:'absolute',visibility:'hidden',width:'max-content',minWidth:'0',padding:'0',border:'0',flex:'none'});
          document.body.append(probe);
          const intrinsic = probe.getBoundingClientRect().width;
          probe.remove();
          return {heading:rect(heading),bundle:rect(bundle),items,intrinsic,rows:new Set(items.map(item=>Math.round(item.top))).size};
        });
        return {summary:rect(summary),divider:rect(columns[1]),sides,overflow:document.documentElement.scrollWidth > innerWidth};
      });
      assert(!geometry.overflow, width+' '+left+': page overflow');
      const [a,b] = geometry.sides;
      assert(Math.abs(geometry.divider.top-geometry.summary.top) < 1 && Math.abs(geometry.divider.bottom-geometry.summary.bottom) < 1,'full-height divider');
      assert.deepEqual(await page.locator('.detail-seen-members .club-identity').allTextContents(),['SEAN','TROY','MATT','JESS'],'member order');
      const fits = a.intrinsic+b.intrinsic+25 <= geometry.summary.width;
      if (fits) {
        assert(a.rows <= 1 && b.rows <= 1,width+' '+left+': premature wrap');
        const expected = geometry.summary.left+a.intrinsic+(geometry.summary.width-a.intrinsic-b.intrinsic-1)/2;
        assert(Math.abs(geometry.divider.left-expected) < 1,width+' '+left+': divider not midway through spare space');
      } else assert(a.rows > 1 || b.rows > 1,width+' '+left+': narrow fallback did not wrap');
      if (a.items.length) assert(Math.abs(a.items[0].left-a.bundle.left) < 1,'left alignment');
      for (const row of new Set(b.items.map(item=>Math.round(item.top)))) {
        const items = b.items.filter(item=>Math.round(item.top)===row);
        assert(Math.abs(items.at(-1).right-b.bundle.right) < 1,'right alignment');
      }
      for (const side of [a,b]) for (const item of side.items) {
        assert(item.left >= side.bundle.left-1 && item.right <= side.bundle.right+1,'member overflow');
        assert.equal(Math.round(item.width),44,'avatar/identity width changed');
      }
      await page.screenshot({path:'.verification/seen-layout/'+width+'-'+left+'.png',fullPage:true});
      results.push({width,left,right:4-left,cardWidth:Math.round(geometry.summary.width),dividerFraction:Number(((geometry.divider.left-geometry.summary.left)/geometry.summary.width).toFixed(3)),rows:[a.rows,b.rows],fits});
    }
  }
  console.log(JSON.stringify(results,null,2));
} finally { await browser.close(); }

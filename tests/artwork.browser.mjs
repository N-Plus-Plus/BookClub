// Run against local Vite. All application API calls and image bytes are intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const fixture=JSON.parse(await fs.readFile('.verification/artwork-snapshot.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext(),page=await context.newPage();
const member=fixture.before.members[0],film=fixture.after.movies.find(m=>m.id===fixture.sample[0]);
let enriched=false,calls=0,failImage=false;
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(url.hostname==='image.tmdb.org') {
    if(failImage) return route.abort();
    return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="185" height="278"><rect width="185" height="278" fill="#384556"/><text x="20" y="140" fill="white">Mock poster</text></svg>'});
  }
  if(path.startsWith('/api/v1/')) {
    const data=enriched?fixture.after:fixture.before;
    if(path.endsWith('/health')) return route.fulfill({json:{data:{environment:'local',authenticationRequired:false,tmdbConfigured:true}}});
    if(path.endsWith('/auth/me')) return route.fulfill({json:{data:{viewer:{...member,role:'admin',avatar:0}}}});
    if(path.endsWith('/catalog')) return route.fulfill({json:{data}});
    if(path.endsWith('/rotation')) return route.fulfill({json:{data:{cycle_id:data.cycles[0].id,nominal_slot:5,version:0}}});
    if(path.endsWith('/movies/enrich-metadata')) {calls++;enriched=true;return route.fulfill({json:{data:fixture.result}});}
    if(path.endsWith('/movies/search')) return route.fulfill({json:{data:{local:[data.movies.find(m=>m.id===film.id)],external:[],lookup:{message:'Mocked local search'}}}});
    if(path.endsWith('/builders')) return route.fulfill({json:{data:[]}});
    if(path.startsWith('/api/v1/movies/')) {
      const movie=data.movies.find(m=>m.id===path.split('/').at(-1));
      return route.fulfill({json:{data:{...movie,...(failImage?{assets:movie.assets.map(a=>({...a,reference:'https://image.tmdb.org/t/p/w500/failed-fixture.jpg'}))}:{}),appearances:[]}}});
    }
    return route.abort();
  }
  if(url.hostname!=='localhost' && url.hostname!=='127.0.0.1') return route.abort();
  return route.continue();
});
try {
  await page.goto('http://localhost:4173/#/history');await page.locator('.poster-empty').first().waitFor();assert.equal(calls,0);
  await page.goto('http://localhost:4173/#/metrics');await page.getByText('Admin · metadata maintenance',{exact:true}).click();
  await page.getByRole('button',{name:'Fill all available metadata',exact:true}).click();
  await page.getByText(/successfully updated/).waitFor();assert.equal(calls,1);
  await page.screenshot({path:'.verification/artwork-maintenance-progress.png',fullPage:true});
  for(const width of [390,900,1440]) {
    await page.setViewportSize({width,height:900});
    for(const screen of ['home','history','builder','classics','seen',`movie/${film.id}`,'metrics']) {
      await page.goto(`http://localhost:4173/#/${screen}`);await page.locator('.data-sources').waitFor();
      if(screen==='builder') {
        await page.getByRole('button',{name:'New set',exact:true}).click();
        await page.getByLabel('Search saved films & TMDB').fill('fixture');await page.getByRole('button',{name:'Search',exact:true}).click();
      }
      if(screen==='metrics') await page.getByText('Admin · metadata maintenance',{exact:true}).click();
      else {
        await page.locator('img.poster').first().waitFor();await page.locator('img.poster').first().scrollIntoViewIfNeeded();
        await page.waitForFunction(()=>[...document.querySelectorAll('img.poster')].some(e=>e.complete && e.naturalWidth>0));
        const refs=await page.locator('img.poster').evaluateAll(es=>es.map(e=>({src:e.src,large:e.classList.contains('poster-large')})));
        assert(refs.every(r=>r.src.includes(r.large?'/w342/':'/w185/')));
      }
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`${width} ${screen} overflow`);
      await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:`.verification/artwork-${width}-${screen.replaceAll('/','-')}.png`,fullPage:true});
      assert.equal(calls,1,'Ordinary screens must not enrich metadata');
    }
  }
  failImage=true;
  await page.goto(`http://localhost:4173/#/movie/${film.id}`);
  await page.getByRole('img',{name:`No poster available for ${film.title}`}).waitFor();
  assert.equal(calls,1);assert.deepEqual(errors,[]);
  console.log('Artwork browser checks passed: desktop/mobile, six poster contexts, maintenance, fallback, sizing and no page-load enrichment.');
} finally {await browser.close();}

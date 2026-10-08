// Synthetic Classics/Builder verification; requires Vite and optional Playwright.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium} = await import(process.env.BOOKCLUB_PLAYWRIGHT_MODULE || '../.verification/node_modules/playwright/index.mjs');
const mainSource=await (await fetch('http://localhost:4173/frontend/main.tsx')).text();
const reactUrl=mainSource.match(/from "([^"]+\/react\.js[^"]*)"/)[1];
const domUrl=mainSource.match(/from "([^"]+\/react-dom_client\.js[^"]*)"/)[1];
const browser = await chromium.launch({executablePath:process.env.BOOKCLUB_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  const page=await browser.newPage();
  const errors=[]; page.on('pageerror',error=>{ errors.push(error.message); console.error(error.message); });
  await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.fallback():route.abort());
  await page.route('**/api/v1/**',route=>route.abort());
  await page.route(/\/frontend\/api\.ts(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`export const api=globalThis.__reviewApi ??= {};export class ApiClientError extends Error {}`}));
  await page.route(/\/frontend\/main\.tsx(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:`
import React from '${reactUrl}';
import ReactDOM from '${domUrl}';
import '/node_modules/@fontsource/lexend-deca/400.css';
import '/node_modules/@fontsource/lexend-deca/600.css';
import '/style.css'; import '/frontend/app.css';
import {AddClassicModal} from '/frontend/AddClassicModal.tsx';
import {ClassicsScreen} from '/frontend/ClassicsScreen.tsx';
import {FilmPicker} from '/frontend/FilmPicker.tsx';
import {api} from '/frontend/api.ts';
import {rankMovie} from '/shared/ranking.ts';
const members=[{id:'m',display_name:'Member',active:1,sort_order:1}];
const movie=id=>({id,title:id==='B'?'A very long film title to verify the selected identity at narrow mobile widths':'Film '+id,original_title:null,year:2000,runtime:111,director:'Fixture Director '+id,overview:'Plot '+id+': a synthetic description for identity confirmation. '.repeat(5),release_date:null,genres:[],assets:[],external_ids:[],scores:[],seen:[],classic:id==='A',ranking:rankMovie([],[],members),appearances:[]});
api.search=async query=>({local:[{id:query,title:movie(query).title,year:2000,tmdbId:null,poster:null}],external:[],lookup:{available:true,message:null}});
api.detail=async id=>movie(id);
api.classic=async id=>({...movie(id),classic:true});
function Screen(){const [movies,setMovies]=React.useState([movie('A')]);const [adding,setAdding]=React.useState(false);const onMovie=m=>setMovies(current=>[...current.filter(f=>f.id!==m.id),m]);const catalog={movies,members,sessions:[],cycles:[]}; return React.createElement(React.Fragment,null,React.createElement('div',{className:'page-heading'},React.createElement('h1',null,'Classics'),React.createElement('div',{className:'page-heading-actions'},React.createElement('button',{className:'button','data-intent':'constructive',onClick:()=>setAdding(true)},'Add Classic'))),adding?React.createElement(AddClassicModal,{catalog,onMovie,onClose:()=>setAdding(false)}):null,React.createElement(ClassicsScreen,{catalog:{movies,members,sessions:[],cycles:[]},movies:movies.filter(m=>m.classic),viewer:{id:'m',display_name:'Member',role:'member',sort_order:1,avatar:1},writesEnabled:true,onMovie:m=>setMovies(current=>[...current.filter(f=>f.id!==m.id),m])}));}
function Builder(){const [selected,setSelected]=React.useState([]);return React.createElement(FilmPicker,{selected,onSelected:setSelected,onMovie:()=>{},allowDirectSelection:true});}
const root=ReactDOM.createRoot(document.getElementById('root'));
window.renderSelection=screen=>root.render(React.createElement('main',{className:'bookclub-shell'},screen==='builder'?React.createElement(Builder,{key:screen}):React.createElement(Screen,{key:screen})));
window.renderSelection('classics');
`}));
  await page.goto('http://localhost:4173/');
  await page.waitForFunction(()=>Boolean(window.renderSelection));
  await fs.mkdir('.verification/film-selection',{recursive:true});
  for(const width of [320,390,720,1440]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>window.renderSelection('builder'));
    const input=page.getByLabel('Search films');
    for(const id of ['A','B']){
      await input.fill(id);await page.getByRole('button',{name:'Search',exact:true}).click();
      await page.getByRole('button',{name:/^Add /}).click();
      await page.waitForFunction(()=>!document.querySelector('.search-row'));
      assert.equal(await input.inputValue(),'');assert(await input.evaluate(el=>el===document.activeElement));
    }
    assert.equal(await page.locator('.lineup-list li').count(),2);
    await page.screenshot({path:'.verification/film-selection/builder-'+width+'.png',fullPage:true});
    await page.evaluate(()=>window.renderSelection('classics'));
    await page.getByRole('button',{name:'Add Classic',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await input.fill('A');await dialog.getByRole('button',{name:'Search',exact:true}).click();
    const select=dialog.getByRole('button',{name:'Select Film A'});
    await select.focus(); await page.keyboard.press('Enter');
    await dialog.getByText('Already listed!',{exact:true}).waitFor();
    assert.equal(await input.inputValue(),'');assert(await input.evaluate(el=>el===document.activeElement));
    assert.equal(await dialog.getByRole('button',{name:'Add Classic',exact:true}).count(),0);
    await input.fill('B');await dialog.getByRole('button',{name:'Search',exact:true}).click();
    await dialog.getByRole('button',{name:/^Select /}).click();
    await dialog.getByRole('button',{name:'Add Classic',exact:true}).waitFor();
    assert.equal(await dialog.locator('.search-row').count(),0);
    assert.equal(await input.inputValue(),'');
    assert.equal(await dialog.getByText('Already listed!',{exact:true}).count(),0);
    await page.evaluate(()=>document.fonts.ready);
    const overflow=await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1);
    assert(!overflow,'Dialog overflow at '+width);
    assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Page overflow at '+width);
    await page.screenshot({path:'.verification/film-selection/classics-'+width+'.png',fullPage:true});
    await dialog.getByRole('button',{name:'Add Classic',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('dialog'));
    await page.getByRole('button',{name:/^Unranked:/}).click();
    assert.equal(await page.locator('.ranking-list .movie-title').count(),2);
    await page.getByRole('button',{name:'Add Classic',exact:true}).click();
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog'));
  }
  assert.deepEqual(errors,[]);
  console.log('8 responsive Classics/Builder checks passed, including keyboard selection, focus, replacement, commit and Escape.');
}finally{await browser.close();}

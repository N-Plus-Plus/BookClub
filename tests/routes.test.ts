// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { pageDefinitions, primaryDestinations, resolveRoute } from '../frontend/routes';
import { Navigation } from '../frontend/Navigation';

const expected = [
  ['home','Home','home.png'], ['history','History','history.png'],
  ['builder','Builder','builder.png'], ['classics','Classics','classsics.png'],
  ['seen','Seen','seen.png'], ['metrics','Metrics','metrics.png'],
];
it('derives every primary destination, heading and image from canonical page definitions',()=>{
  expect(primaryDestinations).toEqual(pageDefinitions.filter(page=>page.primary));
  expect(primaryDestinations.map(page=>[page.path,page.label,page.image])).toEqual(expected);
  for (const [path,heading,image] of expected) {
    expect(resolveRoute(path)).toEqual({path,kind:path,heading,image,dynamic:false});
  }
});
it('retains both navigation surfaces and their paths, labels, images and current-page identity',()=>{
  const container=document.createElement('div');
  container.innerHTML=renderToStaticMarkup(createElement(Navigation,{page:'classics',expanded:true,onToggle:()=>{}}));
  for (const nav of container.querySelectorAll('nav')) {
    expect([...nav.querySelectorAll('a')].map(link=>[
      link.getAttribute('href'),link.querySelector('span')?.textContent,
      link.querySelector('img')?.getAttribute('src')?.split('/').at(-1),
    ])).toEqual(expected.map(([path,label,image])=>[`#/${path}`,label,image]));
    expect(nav.querySelector('[aria-current=page]')?.getAttribute('href')).toBe('#/classics');
  }
});
it('recognises Admin without adding it to primary navigation',()=>{
  expect(resolveRoute('admin')).toEqual({path:'admin',kind:'admin',heading:'Admin',image:'admin.png',dynamic:false});
  expect(primaryDestinations.some(page=>page.path === ('admin' as string))).toBe(false);
});
it.each([
  ['event','event',undefined,'Event','event.png'],
  ['event/event-42','event','event-42','Event','event.png'],
  ['movie/film_42','movie','film_42','Film detail','filmdetails.png'],
  ['preview/tmdb/42','tmdb-preview','42','Film detail','filmdetails.png'],
])('resolves %s and parses its identity once',(path,kind,id,heading,image)=>{
  const route=resolveRoute(path);
  expect(route).toMatchObject({path,kind,heading,image,dynamic:Boolean(id)});
  expect('id' in route ? route.id : undefined).toBe(id);
});
it.each(['unknown','movie','movie/','event/','preview/tmdb/','movie/one/extra','history/one'])('resolves unknown or incomplete %s as not-found',path=>{
  expect(resolveRoute(path)).toEqual({path,kind:'not-found',heading:'Page not found',dynamic:false});
});

// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { SourceScores } from '../frontend/components';
import { parseMdbList } from '../worker/src/providers/mdblist';
import { rankMovie } from '../shared/ranking';
const ratings=[{source:'imdb',value:9},{source:'letterboxd',value:9.2},{source:'metacritic',value:97},{source:'popcorn',value:97},{source:'tomatoes',value:100},{source:'tmdb',value:85}];
const optional=[{source:'metacriticuser',value:9.2},{source:'trakt',value:89},{source:'rogerebert',value:3.5}];
const render=(count:number)=>{
 const scores=parseMdbList({ratings:[...ratings,...optional.slice(0,count-6)]},'2026-10-06','batch');
 const before=structuredClone(scores),node=document.createElement('div');
 node.innerHTML=renderToStaticMarkup(createElement(SourceScores,{scores,ranking:rankMovie(scores,[],[])}));
 expect(scores).toEqual(before);return {node,scores};
};
it.each([6,7,8,9])('%s genuine observations choose the count-based mode and canonical order',count=>{
 const {node,scores}=render(count),row=node.querySelector('.ranking-source-scores')!;
 expect(row.classList.contains('ranking-source-scores-stacked')).toBe(count>6);
 const expected=['IMDb 90','LB 92','MC 97',...(count>6?['MC-U 92']:[]),'RT-A 97','RT-C 100','TMDB 85',...(count>7?['Trakt 89']:[]),...(count>8?['Ebert 87.5']:[])];
 expect([...row.children].map(n=>n.textContent)).toEqual(expected);
 for(const item of row.children){expect(item.getAttribute('title')).toBeTruthy();expect(item.getAttribute('aria-label')).toBe(`${item.getAttribute('title')}: ${item.lastElementChild?.textContent}`);}
 if(count===9)expect(scores.find(s=>s.provider==='rogerebert')).toMatchObject({raw_value:3.5,raw_scale:4,normalized_value:87.5});
});
it('omits missing and imputed sources, including optional-only films outside Classics',()=>{
 const scores=parseMdbList({ratings:[{source:'rogerebert',value:4}]});
 const ranking=rankMovie(scores,[],[]),node=document.createElement('div');
 node.innerHTML=renderToStaticMarkup(createElement(SourceScores,{scores,ranking}));
 expect(node.textContent).toBe('Ebert 100');expect(node.querySelector('span[title]')?.getAttribute('title')).toBe('Roger Ebert Rating');
 expect(renderToStaticMarkup(createElement(SourceScores,{scores:[],ranking:rankMovie([],[],[])}))).toBe('');
 const partial=parseMdbList({ratings:[{source:'imdb',value:9}]});
 node.innerHTML=renderToStaticMarkup(createElement(SourceScores,{scores:partial,ranking:rankMovie(partial,[],[])}));
 expect(node.textContent).toBe('IMDb 90');
});
it.each(['single','batch'] as const)('presents endpoint-specific Letterboxd equivalently (%s)',endpoint=>{
 const scores=parseMdbList({ratings:[{source:'letterboxd',value:endpoint==='single'?4.6:9.2}]},'2026-10-06',endpoint);
 expect(renderToStaticMarkup(createElement(SourceScores,{scores,ranking:rankMovie(scores,[],[])}))).toContain('>92</span>');
});
it('keeps intrinsic columns and readable typography with graceful wrapping',()=>{
 const style=document.createElement('style');style.textContent=readFileSync('frontend/app.css','utf8');document.head.appendChild(style);
 const {node}=render(9);document.body.appendChild(node);
 try{
 const row=getComputedStyle(node.firstElementChild!);expect([row.display,row.flexWrap,row.justifyContent]).toEqual(['flex','wrap','space-between']);
 for(const item of node.firstElementChild!.children){const css=getComputedStyle(item);expect([css.flex,css.display,css.flexDirection,css.alignItems]).toEqual(['0 0 auto','flex','column','center']);}
 }finally{node.remove();style.remove();}
});

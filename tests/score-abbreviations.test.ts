// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SourceScores } from '../frontend/components';
import { ratingDimensions, sourceRatingKeys } from '../shared/rating-dimensions';
let root:Root,container:HTMLDivElement;
const scores=[{provider:'imdb',metric:'rating',raw_value:8,raw_scale:10,normalized_value:80,vote_count:null,fetched_at:''}];
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
 HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.open=true;this.querySelector<HTMLButtonElement>('button')?.focus();});
 HTMLDialogElement.prototype.close=vi.fn(function(this:HTMLDialogElement){this.open=false;});
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();});
it('renders one named decorative Info button outside the observed row, and none for empty scores',async()=>{
 await act(async()=>root.render(h(SourceScores,{scores})));
 const button=container.querySelector<HTMLButtonElement>('button')!;
 expect(container.querySelectorAll('button')).toHaveLength(1);expect(button.getAttribute('aria-label')).toBe('Explain score abbreviations');expect(button.title).toBe('Explain score abbreviations');
 expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
 expect(container.querySelector('.ranking-source-scores')?.contains(button)).toBe(false);
 expect(container.querySelector('.ranking-source-scores')?.textContent).toBe('IMDb 80');
 await act(async()=>root.render(h(SourceScores,{scores:[]})));expect(container.innerHTML).toBe('');
});
it.each(['cancel','close'])('opens the complete canonical glossary and restores focus on %s',async dismissal=>{
 await act(async()=>root.render(h(SourceScores,{scores})));
 const button=container.querySelector<HTMLButtonElement>('button')!;button.focus();
 await act(async()=>button.click());
 const dialog=container.querySelector('dialog')!;expect(dialog.open).toBe(true);expect(dialog.querySelector('h2')?.textContent).toBe('Score abbreviations');
 expect(document.activeElement).toBe(dialog.querySelector('button'));
 const entries=[...dialog.querySelectorAll('dl > div')].map(row=>[row.querySelector('dt')?.textContent,row.querySelector('dd')?.textContent]);
 expect(entries).toEqual(sourceRatingKeys.map(key=>[ratingDimensions[key].compactLabel,ratingDimensions[key].fullLabel]));
 expect(new Set(entries.map(entry=>entry[0])).size).toBe(sourceRatingKeys.length);
 expect(entries).toContainEqual(['RT-A','Rotten Tomatoes Audience Score']);expect(entries).toContainEqual(['RT-C','Rotten Tomatoes Critic Score']);
 for(const optional of ['MC-U','Trakt','Ebert'])expect(entries.some(entry=>entry[0]===optional)).toBe(true);
 await act(async()=>{if(dismissal==='cancel')dialog.dispatchEvent(new Event('cancel',{cancelable:true}));else dialog.querySelector<HTMLButtonElement>('button')!.click();});
 expect(container.querySelector('dialog')).toBeNull();expect(document.activeElement).toBe(button);
 expect(container.querySelector('.ranking-source-scores')?.textContent).toBe('IMDb 80');
});

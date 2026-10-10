// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { DataHealth } from '../frontend/DataHealth';
import { api } from '../frontend/api';
import type { HealthPage } from '../shared/data-health';
vi.mock('../frontend/api',()=>({api:{dataHealth:vi.fn()}}));
let root:ReturnType<typeof createRoot>,node:HTMLDivElement;
const fixture:HealthPage={scanned:80,next:'next',partial:false,films:[{id:'broken',title:'Broken film',year:2000,external_ids:[],locations:[{kind:'builder',label:'Private saved Builder membership · 2 sets'}],issues:[{code:'id',category:'identity',priority:'actionable',label:'IMDb identity missing',explanation:'Identity required.'},{code:'poster',category:'artwork',priority:'confirmed',label:'Missing poster artwork',explanation:'Provider confirmed absence.'}]}]};
beforeEach(()=>{vi.resetAllMocks();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});node=document.createElement('div');document.body.appendChild(node);root=createRoot(node);vi.mocked(api.dataHealth).mockResolvedValue(structuredClone(fixture));});
afterEach(async()=>{await act(async()=>root.unmount());node.remove();});
const render=()=>act(async()=>root.render(createElement(DataHealth)));
const button=(name:string)=>[...node.querySelectorAll('button')].find(b=>b.textContent===name)!;
it('defaults to actionable, keeps canonical navigation and contexts, filters locally and explicitly pages',async()=>{
  await render();expect(node.textContent).toContain('1 affected films · 1 matching issues · 80 films inspected');expect(node.querySelector('a')?.getAttribute('href')).toBe('#/movie/broken');expect(node.textContent).toContain('Private saved Builder membership');expect(node.textContent).not.toContain('Provider confirmed absence.');
  const priority=node.querySelectorAll('select')[1];await act(async()=>{priority.value='all';priority.dispatchEvent(new Event('change',{bubbles:true}));});expect(node.textContent).toContain('Provider confirmed absence.');expect(api.dataHealth).toHaveBeenCalledTimes(1);
  vi.mocked(api.dataHealth).mockResolvedValue({films:[],scanned:1,next:null,partial:false});await act(async()=>button('Inspect next 80 films').click());expect(api.dataHealth).toHaveBeenLastCalledWith('next','',expect.any(AbortSignal));expect(node.textContent).toContain('81 films inspected');
});
it('handles healthy, empty, partial and error results with retry',async()=>{
  vi.mocked(api.dataHealth).mockResolvedValue({films:[],scanned:2,next:null,partial:true});await render();expect(node.textContent).toContain('No actionable exceptions');expect(node.textContent).toContain('Partial diagnostic');
  vi.mocked(api.dataHealth).mockRejectedValue(new Error('Unavailable'));await act(async()=>button('Search / refresh').click());expect(node.querySelector('[role=alert]')?.textContent).toContain('Unavailable');
  vi.mocked(api.dataHealth).mockResolvedValue({films:[],scanned:0,next:null,partial:false});await act(async()=>button('Retry').click());expect(node.textContent).toContain('No films found.');
});

// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { UnifiedMaintenance } from '../frontend/UnifiedMaintenance';
import { CollectionRosterMaintenance } from '../frontend/CollectionRosterMaintenance';
import { aggregateFieldSummary, maintenanceFieldSummary, maintenanceContract, operationInventory } from '../shared/maintenance-contract';
const expected={
  scores:'9 rating types · Vote counts',
  'omdb-metadata':'Title · Release year · Runtime · Director · Genres',
  'tmdb-metadata':'Title · Original title · Release date · Runtime · Overview · Director · Genres · Posters · Backdrops',
  'tmdb-enrichment':'Title · Original language · Budget · Box office · Popularity · Tagline · Countries · Languages · Studios · Cast & crew · Classifications · Keywords · Australian streaming',
  'mdblist-enrichment':'Title · Runtime · Keywords · Film identities',
  'tmdb-collections':'Collection membership · Collection name',
  'omdb-awards':'Awards · Wins · Nominations',
  'collection-rosters':'Franchise titles · Collection films · Release dates · Check status',
};
it('every advertised field has an intentional group, scope, provider and destination in the shared inventory',()=>{
  for(const operation of Object.keys(expected) as (keyof typeof expected)[]){
    expect(maintenanceFieldSummary(operation)).toBe(expected[operation]);
    const c=operationInventory(operation);expect(c.level).toBe(operation==='collection-rosters'?'collection':'film');expect(c.providers.length).toBeGreaterThan(0);expect(c.scope).toBeTruthy();expect(c.populate).toContain('inconclusive');expect(c.refresh).toContain('eligible');
    for(const f of c.fields){expect(f.group).toBeTruthy();expect(f.store).toBeTruthy();expect(f.source).toBeTruthy();}
  }
  expect(Object.keys(maintenanceContract)).toHaveLength(8);
});
it('both actions on all eighteen cards put the same subdued microdot summary immediately beneath the heading',()=>{
  const element=document.createElement('div');element.innerHTML=renderToStaticMarkup(createElement(UnifiedMaintenance,{catalog:{members:[],movies:[],sessions:[],cycles:[]},writesEnabled:true,onUpdated:async()=>{}}))+renderToStaticMarkup(createElement(CollectionRosterMaintenance,{writesEnabled:true}));
  const cards=[...element.querySelectorAll('.classics-maintenance')];expect(cards).toHaveLength(18);
  for(const card of cards){
    const heading=card.querySelector('h3')!,line=heading.nextElementSibling!;
    const operation=heading.id ? heading.id.replace(/^(populate|refresh)-/,'').replace(/-heading$/,'') : 'collection-rosters';
    expect(line.tagName).toBe('P');expect(line.classList.contains('meta')).toBe(true);expect(line.classList.contains('maintenance-field-summary')).toBe(true);
    expect(line.textContent).toBe(operation==='all'?aggregateFieldSummary():expected[operation as keyof typeof expected]);expect(line.childElementCount).toBe(0);expect(line.textContent).toContain(' · ');
    expect(card.querySelector('details summary')?.textContent).toBe('Data collected and safeguards');
  }
  expect(aggregateFieldSummary()).toContain('Franchise membership');expect(aggregateFieldSummary()).toContain('Artwork');
});

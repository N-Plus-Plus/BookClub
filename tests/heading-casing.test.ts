// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { harness, catalog, movies, navigate, button, click, flush } from './helpers/app-integration';
import { App } from '../frontend/App';
import { api } from '../frontend/api';
import { FilmIdentity } from '../frontend/FilmIdentity';
import { AvatarScreen } from '../frontend/AvatarScreen';
import { SeenScreen } from '../frontend/SeenScreen';
import { SessionCard } from '../frontend/components';
import { nonHomeTitles } from '../frontend/app-shell-title';
import { ratingDimensions } from '../shared/rating-dimensions';
import { talentRoles } from '../shared/metrics-enrichment';

const headingTexts = (selector = 'h1,h2,h3,h4') => [...harness.container.querySelectorAll(selector)].map(node => node.textContent);
const remount = async () => {
  await act(async () => harness.root.unmount());
  harness.root = createRoot(harness.container);
  await act(async () => harness.root.render(createElement(App)));
  await flush();
};

it('uses sentence-case Home headings/statistics and preserves Classics, IMDb and the turn overline',async () => {
  await navigate('home');
  expect(headingTexts('.home-dashboard .section-title h2')).toEqual(['Last turn','Next Classics','Quick facts','Club timeline','Classics snapshot']);
  expect([...harness.container.querySelectorAll('.stats-grid .stat > span')].map(node => node.textContent)).toEqual([
    'Events','Films brought','Average IMDb / 10','Days active','Cycles completed','Watch time hh:mm','Eligible Classics','Already seen by all',"Group's missing answers",
  ]);
  expect(harness.container.querySelector('.turn-identity h2')?.textContent).toBe('It is your turn');
  expect(harness.container.querySelector('.brand small')?.textContent).toBe('HAVE YOU UPDATED THE SPREADSH... WEB APP?');
  expect(harness.container.textContent).toContain('Event');
  await navigate('classics'); await click(button('Add Classic'));
  expect(harness.container.querySelector('dialog h2')?.textContent).toBe('Add Classic');
  await click(harness.container.querySelector<HTMLButtonElement>('button[aria-label="Close Add Classic"]')!);
  vi.mocked(api.rotation).mockResolvedValue({id:1,nominal_slot:5,cycle_id:null,version:0,updated_at:''});
  await remount(); await navigate('event');
  expect(harness.container.querySelector('.classics-attestation h2')?.textContent).toBe('Next ranked Classics');
});

it('renders both Admin maintenance groups in sentence case without changing provider names',async () => {
  vi.mocked(api.me).mockResolvedValue({viewer:{...catalog.members[0],avatar:2,role:'admin'}});
  await remount(); await navigate('admin');
  expect(headingTexts('main section.card h2,main section.card h3')).toEqual([
    'Swap current turn','AI predicted','Find a film','Participant History export','Populate missing data','Populate missing scores','Populate missing OMDb metadata','Populate missing TMDB metadata and artwork','Populate missing TMDB enrichment','Populate missing MDBList enrichment','Populate missing TMDB collections','Populate missing OMDb awards',
    'Refresh all data','Refresh scores','Refresh OMDb metadata','Refresh TMDB metadata and artwork','Refresh TMDB enrichment','Refresh MDBList enrichment','Refresh TMDB collections','Refresh OMDb awards','Populate missing collection rosters','Refresh collection rosters',
  ]);
  expect([...harness.container.querySelectorAll('.utility-disclosure summary')].map(node => node.textContent)).toEqual(Array(18).fill('Data collected and safeguards'));
});

it('renders both composite categories/directions, all Metrics tabs and Cabinet roles without recasing canonical identities',async () => {
  await navigate('metrics');
  expect(headingTexts()).not.toContain('Top directors');
  expect(headingTexts()).toContain('Top 5 highest critic scores');
  expect(headingTexts()).toContain('Top 5 most popular · IMDb');
  expect([...harness.container.querySelectorAll('[role=tab]')].map(node => node.textContent)).toEqual(['Top 5','Tastes','Breakdowns','Records']);
  const expectedSources = [['Critics','Critics'],['Audience','Audience']];
  for (const [index,direction] of ['Top','Bottom'].entries()) {
    for (const [label,name] of expectedSources) {
      const section = harness.container.querySelectorAll('.metrics-rankings section')[index];
      await click([...section.querySelectorAll<HTMLButtonElement>('button')].find(node => node.textContent === label)!);
      expect(section.querySelector('h2')?.textContent).toBe(`Top 5 ${direction === 'Top' ? 'highest' : 'lowest'} ${name === 'Critics' ? 'critic' : 'audience'} scores`);
    }
  }
  expect(ratingDimensions['metacritic:user'].name).toBe('Metacritic User');
  expect(ratingDimensions['rottentomatoes:audience'].name).toBe('Rotten Tomatoes - Audience');
  expect(ratingDimensions['rottentomatoes:critic'].name).toBe('Rotten Tomatoes - Critic');
  expect(headingTexts()).toEqual(expect.arrayContaining(['Top 5 highest revenue / budget ratio','Top 5 lowest revenue / budget ratio']));
  await click(button('Breakdowns'));
  expect(headingTexts()).toContain('Australian classification');
  await click(button('Breakdowns')); expect(headingTexts()).toContain('Ratings profile');
  await click(button('Records'));
  expect(headingTexts('.metrics-film-extreme h3')).toEqual(['Top critic','Top audience','Bottom critic','Bottom audience','Most popular','Most obscure','Oldest','Newest','Longest','Shortest']);
  expect(headingTexts('.metrics-creator-extreme h3')).toEqual(['Most recurring director','Most recurring writer','Most recurring composer','Most recurring cinematographer','Most recurring editor','Most recurring producer']);
  expect([...harness.container.querySelectorAll('.metrics-creator-extreme h3 strong')].map(node => node.textContent)).toEqual(['director','writer','composer','cinematographer','editor','producer']);
  expect(talentRoles).toEqual(['Cast','Director','Writer','Cinematographer','Composer','Editor','Producer']);
});

it('preserves inserted film, member, cycle and private-title casing through heading templates',async () => {
  const member = {...catalog.members[0],display_name:'McCASE'};
  const movie = {...movies[0],title:'iT’S a MAD wORLD'};
  const cycle = {id:'cycle',ordinal:12,title:'mY cYCLE',rough_date:'2026-01-01',import_source:null,import_key:null,created_at:'',updated_at:''};
  const session = {id:'session',movies:[movie],host_member_id:member.id,kind:'hosted' as const,event_date:'2026-01-01',date_precision:'exact' as const,cycle_id:cycle.id,cycle_slot:2,legacy_cycle_label:null};
  vi.mocked(api.me).mockResolvedValue({viewer:{...member,avatar:2,role:'member'}});
  vi.mocked(api.catalog).mockResolvedValue({...catalog,members:[member],movies:[movie],cycles:[cycle],sessions:[session]});
  vi.mocked(api.builders).mockResolvedValue([{id:'private',owner_member_id:member.id,title:'FRIDAY iDEAS',notes:null,movie_ids:[movie.id],revision:1,created_at:'2026-01-01',updated_at:''}]);
  await remount(); await navigate('history');
  expect(headingTexts()).toEqual(expect.arrayContaining(['mY cYCLE',"McCASE's week"]));
  expect(harness.container.querySelector('.history-film-director')).toBeNull();
  expect(harness.container.querySelector('.history-grid .movie-title')?.textContent).toBe('iT’S a MAD wORLD');
  expect(harness.container.querySelector('.account-menu-trigger .club-identity')?.textContent).toBe('MCCASE');
  await navigate('builder'); await vi.waitFor(() => expect(headingTexts()).toContain('FRIDAY iDEAS'));
  await click(button('Open set')); await click(button('Use set'));
  expect(headingTexts()).toContain('Use FRIDAY iDEAS?');
  const identity = document.createElement('div');
  identity.innerHTML = renderToStaticMarkup(createElement(FilmIdentity,{movie}));
  expect(identity.querySelector('h2')?.textContent).toBe('iT’S a MAD wORLD');
  identity.innerHTML = renderToStaticMarkup(createElement(SessionCard,{session:{...session,kind:'classics',host_member_id:null},members:[member],variant:'home'}));
  expect(identity.querySelector('h3')?.textContent).toBe('Classics week');
});

it('preserves the entire stylised branding pool and intentional uppercase onboarding/Seen eyebrows',() => {
  expect(nonHomeTitles).toEqual([
    'BOOb lucK','cOOK Bulb','BucKO, lOb!','BucK lObO','O, luBbOcK!','BOb, u lOcK','BlOb cO., uK','Bulb cO., OK',
    'K? cOOl, Bub.','OK, BlOb, c u!','OK, cuB, lOb!','BOb, luc, OK?','BO club, OK?','uK BlOc, bO','c? lOOK, Bub','OK, BOb, clu?','lOcO, Bub, K?','lOu cObB, K?',
  ]);
  const node = document.createElement('div');
  node.innerHTML = renderToStaticMarkup(createElement(AvatarScreen,{viewer:{...catalog.members[0],display_name:'McCASE',avatar:null,role:'member'},onClaimed:vi.fn(),onLogout:vi.fn()}));
  expect(node.querySelector('.eyebrow')?.textContent).toBe('WELCOME, MCCASE');
  const movie = {...movies[0],title:'MiXeD Film TITLE',classic:true};
  node.innerHTML = renderToStaticMarkup(createElement(SeenScreen,{catalog:{...catalog,movies:[movie]},viewerId:catalog.members[0].id,answer:vi.fn(),writesEnabled:true}));
  expect([...node.querySelectorAll('.eyebrow')].map(element => element.textContent)).toEqual(['HAVE YOU SEEN...','THIS VISIT']);
  expect(node.querySelector('.movie-title')?.textContent).toBe('MiXeD Film TITLE');
});

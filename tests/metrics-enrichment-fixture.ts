import { emptyEnrichmentMovie, type MetricsEnrichment } from '../shared/metrics-enrichment';
/** Synthetic cache, with deliberately incomplete MDBList and TMDB coverage. */
export function metricsEnrichmentFixture(): MetricsEnrichment {
  const data: MetricsEnrichment = {movies:{}};
  for (const [index,id] of ['a','b','d',...Array.from({length:6},(_,i) => `extra-${i}`)].entries()) {
    data.movies[id] = {...emptyEnrichmentMovie(),
      metadata:{original_language:index % 3 === 0 ? 'ja' : index % 3 === 1 ? 'en' : 'fr',budget:index === 1 ? 0 : (index+1)*1_000_000,revenue:index === 2 ? 0 : (index+1)*10_000_000},
      languages:[{code:'ja',name:'日本語',english_name:'Japanese'},{code:'fr',name:'Français',english_name:'French'}],
      countries:[{code:'US',name:'United States of America'},{code:'JP',name:'Japan'},{code:'US',name:'United States of America'}],
      companies:[{external_id:'1',name:'A production company with an exceptionally long name that wraps across several lines'},{external_id:'2',name:'Studio Two'},{external_id:'1',name:'A production company with an exceptionally long name that wraps across several lines'}],
      keywords:index === 1 ? [{provider:'mdblist',name:'murder'}] : [{provider:'tmdb',name:'Time Travel'},{provider:'mdblist',name:' time travel '},{provider:'tmdb',name:'serial killer'},{provider:'mdblist',name:'murder'},{provider:'tmdb',name:'A very long theme label that should still fit comfortably in a narrow horizontal chart'}],
      contentRatings:[{certification:'M',release_type:3},{certification:'MA 15+',release_type:2},{certification:'R18+',release_type:5}],
      credits:[{kind:'cast',role:'cast',person_id:'100',name:'A recurring actor with an extraordinarily long name'},
        {kind:'cast',role:'cast',person_id:'100',name:'A recurring actor with an extraordinarily long name'},
        ...['writer','screenplay','cinematographer','composer','editor','producer'].map(role => ({kind:'crew',role,person_id:role === 'screenplay' ? 'writer' : role,name:`Recurring ${role === 'screenplay' ? 'writer' : role}`}))],
    };
  }
  // TMDB-only evidence, no MDBList requirement.
  data.movies['extra-5'].keywords = [{provider:'tmdb',name:'space'}];
  return data;
}

// Synthetic shapes checked against the official contracts and two bounded MDBList probes.
export const tmdbEnrichmentFixture=(id=42) => ({
  id,release_date:null,overview:null,poster_path:null,backdrop_path:null,title:'Provider title',original_title:'Original',runtime:101,original_language:'fr',budget:1000000,revenue:2000000,popularity:12.25,tagline:'A tagline',
  production_countries:[{iso_3166_1:'US',name:'United States of America'},{iso_3166_1:'AU',name:'Australia'}],
  spoken_languages:[{iso_639_1:'en',name:'English',english_name:'English'},{iso_639_1:'fr',name:'Français',english_name:'French'}],
  production_companies:[{id:7,name:'Studio',origin_country:'AU'}],
  credits:{cast:Array.from({length:20},(_,i)=>({id:100+i,name:`Actor ${i}`,original_name:`Original ${i}`,character:`Character ${i}`,order:19-i,credit_id:`cast-${i}`})),
    crew:['Writer','Screenplay','Producer','Director of Photography','Original Music Composer','Editor','Executive Producer','Camera Operator','Director'].map((job,i)=>({id:200+i,name:`Crew ${i}`,original_name:`Original Crew ${i}`,job,department:i<3?'Production':'Camera',credit_id:`crew-${i}`}))},
  keywords:{keywords:[{id:8,name:'courtroom'},{id:9,name:'justice'}]},
  release_dates:{results:[{iso_3166_1:'US',release_dates:[{certification:'PG',type:3,release_date:'2000-01-01T00:00:00.000Z'},{certification:'R',type:4,release_date:'2001-01-01T00:00:00.000Z'},{certification:'',type:1}]},
    {iso_3166_1:'AU',release_dates:[{certification:'M',type:3,release_date:'2000-02-01T00:00:00.000Z'}]},
    {iso_3166_1:'GB',release_dates:[{certification:'15',type:3}]}]},
  'watch/providers':{results:{}},
  external_ids:{imdb_id:'tt0000042'},genres:[{name:'Drama'}],vote_average:8,vote_count:100,
});
export const mdbEnrichmentFixture=(imdb='tt0000042',tmdb=42) => ({
  id:123,title:'MDBList title',runtime:97,type:'movie',ids:{imdb,tmdb,trakt:309,tvdb:572,mal:null,mdblist:'c0ro',placeholder:{}},
  ratings:[{source:'imdb',value:9},{source:'tomatoes',value:92},{source:'popcorn',value:93},{source:'letterboxd',value:9.2},{source:'metacritic',value:85},{source:'tmdb',value:81}],
  streams:[{id:2,name:'Prime Video'},{id:14,name:'Kanopy'}],watch_providers:[{id:2,name:'Apple TV Store'},{id:2,name:'Apple TV Store'},{id:3,name:'Google Play Movies'}],
  keywords:[{id:3022,name:'judge'},{id:5043,name:'jurors'}],
});

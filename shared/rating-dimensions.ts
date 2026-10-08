import { requiredScores } from './ranking';

// Identity/presentation only. Ranking policy and provider retrieval/parsing stay separate.
function dimension<K extends string, M extends {fullLabel:string;compactLabel:string;providerName:string;ratingLabel:string;id:string;name:string;profileName?:string;scale:number;group:'audience'|'critic'}>(key:K, metadata:M) {
  const [provider,metric] = key.split(':');
  return {...metadata,key,provider,metric,profileName:metadata.profileName ?? metadata.name,rankingRequired:requiredScores.some(required => required === key)};
}
export const ratingDimensions = {
  'imdb:rating': dimension('imdb:rating',{fullLabel:'IMDb Rating',compactLabel:'IMDb',providerName:'IMDb',ratingLabel:'IMDb',id:'imdb',name:'IMDb',scale:10,group:'audience'} as const),
  'letterboxd:rating': dimension('letterboxd:rating',{fullLabel:'Letterboxd Rating',compactLabel:'LB',providerName:'Letterboxd',ratingLabel:'Letterboxd',id:'letterboxd',name:'Letterboxd',scale:5,group:'audience'} as const),
  'metacritic:critic': dimension('metacritic:critic',{fullLabel:'Metacritic Critic Score',compactLabel:'MC',providerName:'Metacritic',ratingLabel:'Metacritic',id:'metacritic',name:'Metacritic',profileName:'Metacritic critic',scale:100,group:'critic'} as const),
  'metacritic:user': dimension('metacritic:user',{fullLabel:'Metacritic User Score',compactLabel:'MC-U',providerName:'Metacritic',ratingLabel:'Metacritic',id:'metacritic-user',name:'Metacritic User',scale:10,group:'audience'} as const),
  'rottentomatoes:audience': dimension('rottentomatoes:audience',{fullLabel:'Rotten Tomatoes Audience Score',compactLabel:'RT-A',providerName:'Rotten Tomatoes',ratingLabel:'RT audience',id:'rt-audience',name:'Rotten Tomatoes - Audience',scale:100,group:'audience'} as const),
  'rottentomatoes:critic': dimension('rottentomatoes:critic',{fullLabel:'Rotten Tomatoes Critic Score',compactLabel:'RT-C',providerName:'Rotten Tomatoes',ratingLabel:'RT critic',id:'rt-critic',name:'Rotten Tomatoes - Critic',scale:100,group:'critic'} as const),
  'tmdb:rating': dimension('tmdb:rating',{fullLabel:'TMDB Rating',compactLabel:'TMDB',providerName:'TMDB',ratingLabel:'TMDB',id:'tmdb',name:'TMDB',scale:10,group:'audience'} as const),
  'trakt:rating': dimension('trakt:rating',{fullLabel:'Trakt Rating',compactLabel:'Trakt',providerName:'Trakt',ratingLabel:'trakt',id:'trakt',name:'Trakt',scale:100,group:'audience'} as const),
  'rogerebert:rating': dimension('rogerebert:rating',{fullLabel:'Roger Ebert Rating',compactLabel:'Ebert',providerName:'Roger Ebert',ratingLabel:'rogerebert',id:'ebert',name:'Roger Ebert',scale:4,group:'critic'} as const),
} as const;
export type RatingDimensionKey = keyof typeof ratingDimensions;
export function ratingDimension(provider:string,metric:string) {
  return ratingDimensions[`${provider}:${metric}` as RatingDimensionKey];
}

// Screens intentionally retain different orders and subsets, using canonical keys.
export const sourceRatingKeys = ['imdb:rating','letterboxd:rating','metacritic:user','rottentomatoes:audience','tmdb:rating','trakt:rating','rogerebert:rating','metacritic:critic','rottentomatoes:critic'] as const satisfies readonly RatingDimensionKey[];
export const detailRatingKeys = ['imdb:rating','letterboxd:rating','metacritic:critic','rottentomatoes:audience','rottentomatoes:critic','tmdb:rating'] as const satisfies readonly RatingDimensionKey[];
export const metricsRatingKeys = ['imdb:rating','letterboxd:rating','metacritic:critic','metacritic:user','rottentomatoes:audience','rottentomatoes:critic','tmdb:rating','trakt:rating','rogerebert:rating'] as const satisfies readonly RatingDimensionKey[];
// Nominal display axes above never override an observation's endpoint-specific raw scale.

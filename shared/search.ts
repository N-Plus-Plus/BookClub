import type { FilmCandidate, SearchResponse } from './types';

export function normalizeTitle(title: string): string {
  return title.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/['’‘ʼ]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().replace(/\s+/g,' ').replace(/^(a|the) /,'');
}
export function matchTitles<T extends {title: string}>(candidates: T[], query: string): T[] {
  const term = titleKey(query);
  if (!term) return [];
  const strict = candidates.filter(candidate => titleKey(candidate.title) === term);
  return strict.length ? strict : candidates.filter(candidate => titleKey(candidate.title).includes(term));
}
/** Whitespace and punctuation do not separate otherwise identical title characters. */
export const titleKey = (title: string) => normalizeTitle(title).replace(/\s/g,'');

// Bounded edit distance: long, unrelated words leave before allocating a full matrix.
function editDistance(a: string,b: string,limit: number): number {
  if (Math.abs(a.length-b.length)>limit) return limit+1;
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for (let i=1;i<=a.length;i++) {
    const next=[i];
    for (let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+Number(a[i-1]!==b[j-1]));
    if (Math.min(...next)>limit) return limit+1;
    row=next;
  }
  return row[b.length];
}
function fuzzyScore(title: string,query: string): number {
  const term=normalizeTitle(query),key=titleKey(query),target=normalizeTitle(title),targetKey=titleKey(title);
  if (key.length<4 || !/\p{L}/u.test(key)) return 0;
  const words=term.split(' '),tokens=target.split(' '),used=new Set<number>();
  let total=0,anchor=false,previous=-1,inOrder=true,prefix=true;
  for (let i=0;i<words.length;i++) {
    const word=words[i];let best=0,index=-1;
    for (let j=0;j<tokens.length;j++) {
      if (used.has(j)) continue;
      const token=tokens[j];let score=0;
      if (word===token) score=1;
      else if (i===words.length-1 && word.length>=(words.length>1 ? 2 : 4) && token.startsWith(word)) score=0.9;
      else if (word.length>=5) {
        const limit=word.length>=7 ? 2 : 1, distance=editDistance(word,token,limit);
        if (distance<=limit && 1-distance/Math.max(word.length,token.length)>=0.75) score=1-distance/Math.max(word.length,token.length);
      }
      if (score>best) {best=score;index=j;}
    }
    if (index<0) {total=0;break;}
    used.add(index);total+=best;
    if (word.length>=4 && best>=0.8) anchor=true;
    if (index<=previous) inOrder=false;
    if (index!==i) prefix=false;
    previous=index;
  }
  const coverage=total/words.length;
  let score=anchor && coverage>=0.8 ? coverage*0.8+(prefix ? 0.15 : inOrder ? 0.07 : 0)-Math.min(0.1,(tokens.length-words.length)*0.015) : 0;
  // Also tolerate omitted spaces and a typo in an otherwise credible title prefix.
  if (key.length>=5) {
    const limit=Math.min(2,Math.floor(key.length*0.16));
    for (let size=Math.max(1,key.length-limit);size<=Math.min(targetKey.length,key.length+limit);size++) {
      const distance=editDistance(key,targetKey.slice(0,size),limit),similarity=1-distance/Math.max(key.length,size);
      if (distance<=limit && similarity>=0.84) score=Math.max(score,similarity*0.85+0.08-Math.min(0.08,(targetKey.length-size)*0.002));
    }
  }
  return score;
}
/** Conservative zero-results suggestions; stable ties retain existing source order. */
export function fuzzyTitles<T extends {title:string}>(candidates:T[],query:string):T[] {
  return candidates.map((candidate,index)=>({candidate,index,score:fuzzyScore(candidate.title,query)}))
    .filter(row=>row.score>=0.65).sort((a,b)=>b.score-a.score || a.index-b.index).slice(0,24).map(row=>row.candidate);
}
export const SEARCH_PAGE_SIZE = 6;
export function searchCandidates(results: SearchResponse): FilmCandidate[] {
  const localIds = new Set(results.local.map(movie => movie.tmdbId).filter(Boolean));
  return [...results.local.map(movie => ({kind:'local' as const,movie})),
    ...results.external.filter(movie => !localIds.has(movie.externalId)).map(movie => ({kind:'external' as const,movie}))];
}
export function candidatePage<T>(candidates: T[], page: number) {
  const pages = Math.max(1,Math.ceil(candidates.length / SEARCH_PAGE_SIZE));
  const current = Math.max(1,Math.min(page,pages));
  return {items:candidates.slice((current-1)*SEARCH_PAGE_SIZE,current*SEARCH_PAGE_SIZE),page:current,pages};
}

import { useEffect, useRef, useState } from 'react';
import { selectShellTitle } from './app-shell-title';
import { resolveRoute } from './routes';
const readHashRoute = () => window.location.hash.slice(2) || 'home';
const isDetail = (path:string) => ['movie','tmdb-preview'].includes(resolveRoute(path).kind);
export function useHashRoute(onTransition:(next:string,previous:string)=>boolean) {
  const [page,setPage]=useState(readHashRoute);
  const pageRef=useRef(page);
  const [shellTitle,setShellTitle]=useState(()=>selectShellTitle(page));
  const heading=useRef<HTMLHeadingElement>(null);
  const transition=useRef(onTransition); transition.current=onTransition;
  const entries=useRef<{path:string;scroll:number}[]>([{path:page,scroll:0}]);
  const current=useRef(0);
  const [detailOrigin,setDetailOrigin]=useState<{path:string;index:number}|null>(null);
  const origin=useRef(detailOrigin);
  useEffect(()=>{
    const visit=crypto.randomUUID();
    const mark=(index:number)=>window.history.replaceState({...window.history.state,bookclubVisit:visit,bookclubEntry:index},'');
    mark(0);
    const saveScroll=()=>{entries.current[current.current].scroll=window.scrollY;};
    const update=()=>{
      saveScroll();
      const next=readHashRoute(), focus=transition.current(next,pageRef.current);
      const state=window.history.state;
      const known=state?.bookclubVisit === visit && entries.current[state.bookclubEntry]?.path === next;
      const previousIndex=current.current;
      if (known) current.current=state.bookclubEntry;
      else { entries.current=entries.current.slice(0,current.current+1); entries.current.push({path:next,scroll:0});current.current=entries.current.length-1;mark(current.current); }
      if (isDetail(next) && !isDetail(pageRef.current) && resolveRoute(pageRef.current).kind !== 'not-found') {
        // Only an origin visited in this mount is trustworthy; refresh starts with none.
        origin.current={path:pageRef.current,index:previousIndex};setDetailOrigin(origin.current);
      } else if (!isDetail(next) && next !== origin.current?.path) {origin.current=null;setDetailOrigin(null);}
      if (next !== pageRef.current) setShellTitle(selectShellTitle(next));
      pageRef.current=next; setPage(next);
      const scroll=entries.current[current.current].scroll;
      requestAnimationFrame(()=>{
        if (focus) heading.current?.focus({preventScroll:true});
        window.scrollTo(0,scroll);
      });
    };
    document.addEventListener('click',saveScroll,true);
    window.addEventListener('hashchange',update);
    return ()=>{window.removeEventListener('hashchange',update);document.removeEventListener('click',saveScroll,true);};
  },[]);
  const backFromDetail=()=>{
    const context=origin.current;
    if (context && current.current > context.index && entries.current[context.index]?.path === context.path) window.history.go(context.index-current.current);
    else window.location.hash='/home';
  };
  return {page,route:resolveRoute(page),shellTitle,heading,detailOrigin,backFromDetail};
}

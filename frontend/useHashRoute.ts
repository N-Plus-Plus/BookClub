import { useEffect, useRef, useState } from 'react';
import { selectShellTitle } from './app-shell-title';
import { resolveRoute } from './routes';
const readHashRoute = () => window.location.hash.slice(2) || 'home';
export function useHashRoute(onTransition:(next:string,previous:string)=>boolean) {
  const [page,setPage]=useState(readHashRoute);
  const pageRef=useRef(page);
  const [shellTitle,setShellTitle]=useState(()=>selectShellTitle(page));
  const heading=useRef<HTMLHeadingElement>(null);
  const transition=useRef(onTransition); transition.current=onTransition;
  useEffect(()=>{
    const update=()=>{
      const next=readHashRoute(), focus=transition.current(next,pageRef.current);
      if (next !== pageRef.current) setShellTitle(selectShellTitle(next));
      pageRef.current=next; setPage(next); window.scrollTo(0,0);
      if (focus) requestAnimationFrame(()=>heading.current?.focus());
    };
    window.addEventListener('hashchange',update);
    return ()=>window.removeEventListener('hashchange',update);
  },[]);
  return {page,route:resolveRoute(page),shellTitle,heading};
}

import { PaginationControls } from './PaginationControls';
import { useState, type ReactNode } from 'react';

/** Bound mounted rows while retaining every result, including all cutoff ties. */
export function MetricsResults<T>({items,render,label,pageSize=20,list=false}: {items:readonly T[];render:(item:T,index:number)=>ReactNode;label:string;pageSize?:number;list?:boolean}) {
  const [selection,setSelection]=useState({items,page:0});
  const page=selection.items === items ? Math.min(selection.page,Math.max(0,Math.ceil(items.length/pageSize)-1)) : 0;
  const pages=Math.ceil(items.length/pageSize);
  const Footer=list ? 'li' : 'div';
  return <>{items.slice(page*pageSize,(page+1)*pageSize).map((item,index)=>render(item,page*pageSize+index))}{pages>1 && <Footer className="button-set metrics-result-pages" role="group" aria-label={`${label} pages`}><PaginationControls page={page+1} pages={pages} onPage={value=>setSelection({items,page:value-1})} status>{page+1} / {pages} · {items.length} results</PaginationControls></Footer>}</>;
}

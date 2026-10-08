import { formatCount } from '../shared/format';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Action } from './components';
/** Contents only: consumers keep their semantic div/li wrapper and count wording. */
export function PaginationControls({page,pages,onPage,disabled=false,children,status=false}: {
  page:number;pages:number;onPage:(page:number)=>void;disabled?:boolean;children?:ReactNode;status?:boolean;
}) {
  return <><Action icon={ChevronLeft} disabled={disabled || page<=1} onClick={()=>onPage(page-1)}>Previous</Action>
    <span className="meta" role={status ? 'status' : undefined}>{children ?? <>Page {formatCount(page)} of {formatCount(pages)}</>}</span>
    <Action icon={ChevronRight} disabled={disabled || page>=pages} onClick={()=>onPage(page+1)}>Next</Action></>;
}

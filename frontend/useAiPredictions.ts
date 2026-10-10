import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiPrediction, Catalog, Viewer } from '../shared/types';
import { api } from './api';

export function useAiPredictions(viewer:Viewer|null,catalog:Catalog|null) {
  const id=viewer?.id;
  const [preference,setPreference]=useState<{id:string;show:boolean}|null>(null);
  const [rows,setRows]=useState<{id:string;rows:AiPrediction[]}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const identity=useRef(id),writing=useRef(false),revision=useRef(0);
  const listRevision=useRef(0);
  useEffect(()=>{identity.current=id;revision.current++;writing.current=false;setBusy(false);setError('');setPreference(null);setRows(null);if(!id)return;let cancelled=false;const version=revision.current;
    void api.preferences().then(value=>{if(!cancelled && revision.current===version)setPreference({id,show:value.show_ai});}).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[id]);
  const show=Boolean(id && preference?.id===id && preference.show);
  useEffect(()=>{if(!id)return;let cancelled=false;const version=++listRevision.current;
    void api.predictions().then(value=>{if(!cancelled && listRevision.current===version)setRows({id,rows:value});}).catch(e=>{if(!cancelled && listRevision.current===version)setError(e.message);});
    return()=>{cancelled=true;};
  },[id,show,catalog]);
  const updated=useCallback((value:AiPrediction[])=>{listRevision.current++;if(id)setRows({id,rows:value});},[id]);
  const toggle=useCallback(async()=>{
    if(!id || preference?.id!==id || writing.current)return;
    writing.current=true;const version=++revision.current;setBusy(true);setError('');const previous=preference.show;
    setPreference({id,show:!previous});
    try{await api.setShowAi(!previous);}catch(e){if(identity.current===id && revision.current===version){setPreference({id,show:previous});setError(e instanceof Error?e.message:'Could not save preference.');}}
    finally{if(identity.current===id && revision.current===version){writing.current=false;setBusy(false);}}
  },[id,preference]);
  return {show,predictions:rows && rows.id===id?rows.rows:[],busy:busy || Boolean(id && preference?.id!==id),error,toggle,updated};
}

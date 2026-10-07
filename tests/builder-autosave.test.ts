import { expect, it, vi } from 'vitest';
import { BuilderAutosave } from '../frontend/builder-autosave';
import type { BuilderSet } from '../shared/types';
const saved = (revision:number,movie_ids:string[] = []):BuilderSet => ({id:'set',owner_member_id:'owner',title:'',notes:'',movie_ids,revision,created_at:'',updated_at:''});
const deferred = <T>() => {let resolve!:(value:T)=>void, reject!:(error:Error)=>void; const promise = new Promise<T>((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject};};
it('creates only on request, serialises rapid changes, coalesces intermediates and adopts the returned revision',async()=>{
 const first=deferred<BuilderSet>(), second=deferred<BuilderSet>();
 const write=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise), accepted=vi.fn();
 const queue=new BuilderAutosave(null,write,accepted,vi.fn());
 queue.current.title='Typing'; expect(write).not.toHaveBeenCalled();
 queue.current.movie_ids=['A'];const pending=queue.enqueue();await Promise.resolve();
 expect(write).toHaveBeenCalledExactlyOnceWith({title:'Typing',notes:'',movie_ids:['A']},undefined);
 queue.current.movie_ids=['A','B'];void queue.enqueue();queue.current.movie_ids=['B','A','C'];void queue.enqueue();
 expect(write).toHaveBeenCalledTimes(1);
 first.resolve({...saved(7,['A']),title:'Typing'});await new Promise(resolve=>setTimeout(resolve,0));
 expect(write).toHaveBeenLastCalledWith({title:'Typing',notes:'',movie_ids:['B','A','C'],revision:7},'set');
 expect(queue.current.movie_ids).toEqual(['B','A','C']);expect(accepted).toHaveBeenCalledTimes(1);
 second.resolve({...saved(8,['B','A','C']),title:'Typing'});expect((await pending).revision).toBe(8);
 await queue.flush();expect(write).toHaveBeenCalledTimes(2);
});
it('keeps dirty latest state on failure without a retry loop; next edit or explicit flush retries',async()=>{
 const fail=deferred<BuilderSet>(), write=vi.fn().mockReturnValueOnce(fail.promise).mockResolvedValueOnce(saved(4,['B'])), failed=vi.fn();
 const queue=new BuilderAutosave(saved(3,['A']),write,vi.fn(),failed);
 queue.current.movie_ids=[];const pending=queue.enqueue();await Promise.resolve();queue.current.movie_ids=['B'];void queue.enqueue().catch(()=>{});
 fail.reject(new Error('Unavailable'));await expect(pending).rejects.toThrow('Unavailable');expect(queue.current.movie_ids).toEqual(['B']);
 expect(queue.saved?.revision).toBe(3);expect(write).toHaveBeenCalledTimes(1);expect(failed).toHaveBeenCalledOnce();
 expect((await queue.flush()).revision).toBe(4);expect(write).toHaveBeenLastCalledWith({title:'',notes:'',movie_ids:['B'],revision:3},'set');
});
it('flush includes current unblurred fields and waits through the final saved revision before publication',async()=>{
 const first=deferred<BuilderSet>(),second=deferred<BuilderSet>(),write=vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
 const queue=new BuilderAutosave(saved(1),write,vi.fn(),vi.fn());queue.current.movie_ids=['A'];void queue.enqueue();await Promise.resolve();
 queue.current.notes='Newest note';const publish=vi.fn();const action=queue.flush().then(set=>publish(set.revision));
 first.resolve(saved(2,['A']));await new Promise(resolve=>setTimeout(resolve,0));expect(publish).not.toHaveBeenCalled();
 expect(write).toHaveBeenLastCalledWith({title:'',notes:'Newest note',movie_ids:['A'],revision:2},'set');
 second.resolve({...saved(3,['A']),notes:'Newest note'});await action;expect(publish).toHaveBeenCalledWith(3);
});

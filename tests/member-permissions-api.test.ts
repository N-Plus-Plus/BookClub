import { describe, expect, it } from 'vitest';





import { identityPresentation, needsAvatar } from '../shared/identity';
import type { Viewer } from '../shared/types';

import { local, call, data, viewer } from './helpers/product-api';

describe('member avatars and roles',()=>{
  it('returns nullable avatars/roles and requires onboarding, including pre-existing sessions',async()=>{
    const member=await viewer(),admin=await viewer(2);expect(member.role).toBe('member');expect(admin.role).toBe('admin');expect(needsAvatar(member)).toBe(true);
    expect(await data<number[]>(await call('/avatars'))).toHaveLength(20);
    const claimed=await data<Viewer>(await call('/auth/avatar','POST',{avatar:0}));expect(claimed).toMatchObject({id:'member-1',avatar:0});expect(needsAvatar(claimed)).toBe(false);expect(needsAvatar(null)).toBe(false);
    expect((await viewer()).avatar).toBe(0);expect(await data<number[]>(await call('/avatars'))).not.toContain(0);
  });
  it('accepts 0–19 and rejects Classics, fractions, range and owner spoofing',async()=>{
    for(let avatar=0;avatar<20;avatar++) {
      local.sqlite.exec("UPDATE members SET avatar=NULL WHERE id='member-1'");expect((await call('/auth/avatar','POST',{avatar})).status).toBe(200);
    }
    for(const avatar of ['a',-1,20,1.5,null]) expect((await call('/auth/avatar','POST',{avatar})).status).toBe(422);
    expect((await call('/auth/avatar','POST',{avatar:3,member_id:'member-2'})).status).toBe(422);
  });
  it('enforces DB uniqueness, safe collision and one-time claims',async()=>{
    const results=await Promise.all([call('/auth/avatar','POST',{avatar:5}),call('/auth/avatar','POST',{avatar:5},2)]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(local.sqlite.prepare('SELECT count(*) n FROM members WHERE avatar=5').get()?.n).toBe(1);
    expect(()=>local.sqlite.exec("UPDATE members SET avatar=5 WHERE id='member-4'")).toThrow();expect(()=>local.sqlite.exec("UPDATE members SET avatar=20 WHERE id='member-4'")).toThrow();
    expect(()=>local.sqlite.exec("UPDATE members SET avatar=1.5 WHERE id='member-4'")).toThrow();
    expect((await call('/auth/avatar','POST',{avatar:6})).status).toBe(409);
    expect(await (await call('/auth/avatar','POST',{avatar:5},4)).text()).not.toContain('UNIQUE constraint');
  });
  it('uses explicit Classics presentation and base-aware member assets',()=>{
    expect(identityPresentation({kind:'classics'},'/BookClub/')).toEqual({name:'CLSC',avatar:'/BookClub/avatars/a.png'});
    expect(identityPresentation({kind:'classics'},'/')).toEqual({name:'CLSC',avatar:'/avatars/a.png'});
    expect(identityPresentation({kind:'member',member:{id:'x',display_name:'Test',avatar:0}},'/BookClub/')).toEqual({name:'TEST',avatar:'/BookClub/avatars/0.png'});
  });
});

it('Seen writes and Undo are personal even for admins',async()=>{ local.sqlite.exec("DELETE FROM seen_states WHERE movie_id='arrival'"); expect((await call('/movies/arrival/seen/member-1','PUT',{seen:true},2)).status).toBe(403); await data(await call('/movies/arrival/seen/member-2','PUT',{seen:true},2)); expect(local.sqlite.prepare("SELECT member_id,seen FROM seen_states WHERE movie_id='arrival'").all()).toEqual([{member_id:'member-2',seen:1}]); await data(await call('/movies/arrival/seen/member-1','PUT',{seen:false},1)); await data(await call('/movies/arrival/seen/member-2','PUT',{seen:null},2)); expect(local.sqlite.prepare("SELECT member_id,seen FROM seen_states WHERE movie_id='arrival'").all()).toEqual([{member_id:'member-1',seen:0}]); });

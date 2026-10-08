import { describe, expect, it } from 'vitest';
import { clubTimeline, daysActive, formatTimelineNumber, formatWatchTime } from '../shared/metrics-summary';
import type { Catalog, Cycle } from '../shared/types';
import { metricsEvent, metricsFilm } from './metrics-fixture';

const today = new Date(2026,9,8);
const cycle = (id: string): Cycle => ({id,ordinal:1,rough_date:'2020-07-05',title:null,import_source:null,import_key:null,created_at:'',updated_at:''});
const empty = (): Catalog => ({members:[],movies:[],sessions:[],cycles:[]});
describe('Club Timeline',() => {
  it('counts inclusive local calendar dates and formats whole Australian numbers',() => {
    expect(daysActive(new Date(2020,6,5))).toBe(1);
    expect(daysActive(new Date(2020,6,6))).toBe(2);
    expect(daysActive(today)).toBe(2287);
    expect(formatTimelineNumber(daysActive(today))).toBe('2,287');
  });
  it('uses local date parts regardless of time of day or DST day length',() => {
    // Sydney clocks advance on 4 October 2026 and retreat on 5 April 2026.
    for (const [month,day] of [[9,4],[3,5]]) {
      const before = new Date(2026,month,day-1,23,59);
      const after = new Date(2026,month,day,0,1);
      expect(daysActive(after)-daysActive(before)).toBe(1);
      expect(daysActive(new Date(2026,month,day,23,59))).toBe(daysActive(after));
    }
    // Explicitly simulate a local date differing from the UTC date and unequal midnight lengths.
    const local = (day: number,instant: string) => Object.assign(new Date(instant),{
      getFullYear:() => 2026,getMonth:() => 9,getDate:() => day,
    });
    expect(daysActive(local(5,'2026-10-04T13:00:00Z'))-daysActive(local(4,'2026-10-03T14:00:00Z'))).toBe(1);
    expect(daysActive(local(4,'2026-10-03T14:00:00Z'))).toBe(2283);
  });
  it('reports the latest completed ordinal through imported gaps and ignores unfinished future cycles',() => {
    const data=empty();data.cycles=[{...cycle('old'),ordinal:12,import_source:'archive'},{...cycle('55'),ordinal:55},{...cycle('56'),ordinal:56}];
    const final=(id:string,version:number|null)=>({...metricsEvent(`final-${id}`,[],null),cycle_id:id,cycle_slot:5,completed_turn_version:version});
    data.sessions=[final('old',null),final('55',8),{...metricsEvent('future',[]),cycle_id:'56',cycle_slot:1,completed_turn_version:null}];
    expect(clubTimeline(data,today).cyclesCompleted).toBe(55);
    data.sessions.push(final('56',null));expect(clubTimeline(data,today).cyclesCompleted).toBe(55);
    data.sessions.at(-1)!.completed_turn_version=9;expect(clubTimeline(data,today).cyclesCompleted).toBe(56);
    data.sessions.at(-1)!.deleted_at='2026-10-08';expect(clubTimeline(data,today).cyclesCompleted).toBe(55);
    data.sessions[1].kind='hosted';expect(clubTimeline(data,today).cyclesCompleted).toBe(12);
    data.sessions.push(final('unrelated',100));expect(clubTimeline(data,today).cyclesCompleted).toBe(12);
  });
  it('accepts a completed next first turn as chronology evidence, but not an unfinished turn',()=>{
    const data=empty();data.cycles=[{...cycle('56'),ordinal:56}];
    data.sessions=[{...metricsEvent('first',[]),cycle_id:'56',cycle_slot:1,completed_turn_version:null}];
    expect(clubTimeline(data,today).cyclesCompleted).toBe(0);
    data.sessions[0].completed_turn_version=10;expect(clubTimeline(data,today).cyclesCompleted).toBe(55);
  });
  it('sums canonical runtime for each active History appearance, retaining repeats and ignoring unknowns',() => {
    const film = metricsFilm('known',{runtime:61}), unknown = metricsFilm('unknown',{runtime:null});
    const data = {...empty(),movies:[film,unknown],sessions:[metricsEvent('first',[{...film,runtime:999},unknown,film]),metricsEvent('second',[film]),{...metricsEvent('deleted',[film]),deleted_at:'2026-01-01'}]};
    expect(clubTimeline(data,today).watchMinutes).toBe(183);
    expect(formatWatchTime(clubTimeline(data,today).watchMinutes)).toBe('3:03');
    expect(clubTimeline(empty(),today).watchMinutes).toBe(0);
  });
  it.each([[0,'0:00'],[59,'0:59'],[60,'1:00'],[61,'1:01'],[36867,'614:27'],[51766,'862:46']])('formats %i minutes as %s',(minutes,label) => {
    expect(formatWatchTime(minutes)).toBe(label);
  });
});

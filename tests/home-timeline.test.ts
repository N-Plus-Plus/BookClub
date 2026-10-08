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
  it('requires all five distinct active turns of a known cycle, including Classics',() => {
    const data = empty(); data.cycles = ['complete','partial','empty','deleted','wrong-kind'].map(cycle);
    const turns = (id: string,slots: number[]) => slots.map(slot => ({...metricsEvent(`${id}-${slot}`,[],slot === 5 ? null : 'm1'),cycle_id:id,cycle_slot:slot}));
    data.sessions = [...turns('complete',[1,2,3,4,5]),...turns('partial',[1,2,3,4]),...turns('deleted',[1,2,3,4,5]),...turns('wrong-kind',[1,2,3,4,5]),...turns('unknown',[1,2,3,4,5])];
    data.sessions.find(s => s.id === 'deleted-3')!.deleted_at = '2026-01-01';
    data.sessions.find(s => s.id === 'wrong-kind-5')!.kind = 'hosted';
    data.sessions.push({...data.sessions[0],id:'duplicate'});
    expect(clubTimeline(data,today).cyclesCompleted).toBe(1);
    data.sessions.push(...turns('partial',[5]));
    expect(clubTimeline(data,today).cyclesCompleted).toBe(2);
  });
  it('sums canonical runtime for each active History appearance, retaining repeats and ignoring unknowns',() => {
    const film = metricsFilm('known',{runtime:61}), unknown = metricsFilm('unknown',{runtime:null});
    const data = {...empty(),movies:[film,unknown],sessions:[metricsEvent('first',[{...film,runtime:999},unknown,film]),metricsEvent('second',[film]),{...metricsEvent('deleted',[film]),deleted_at:'2026-01-01'}]};
    expect(clubTimeline(data,today).watchMinutes).toBe(183);
    expect(formatWatchTime(clubTimeline(data,today).watchMinutes)).toBe('3 hr 3 min');
    expect(clubTimeline(empty(),today).watchMinutes).toBe(0);
  });
  it.each([[0,'0 hr 0 min'],[59,'0 hr 59 min'],[60,'1 hr 0 min'],[61,'1 hr 1 min'],[36867,'614 hr 27 min']])('formats %i minutes as %s',(minutes,label) => {
    expect(formatWatchTime(minutes)).toBe(label);
  });
});

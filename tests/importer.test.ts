import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { analyseWorkbook, configSchema } from '../scripts/import/workbook';
import { rawPlanSchema } from '../scripts/import/model';
export function fixture() {
  const w=new ExcelJS.Workbook(), t=w.addWorksheet('Tracker'), c=w.addWorksheet('Should Watch'), o=w.addWorksheet('Watch Order'), h=w.addWorksheet('Sheet2');
  t.addRow(['Rough date','Host 1','Host 2','Host 3','Host 4','Classics Collection','Not Book Club']);
  t.addRow([new Date('2001-01-01'),'Film A','Film B','Film C','Film D','Candidate A','Ancillary']);
  t.addRow([null,'Second film',null,'Second C']); t.addRow([null,null,null,'Third C']);
  t.mergeCells('A2:A4'); t.mergeCells('B2:B2');
  t.addRow([new Date('2001-02-01'),'Film E','Film F','Film G','Film H']);
  c.addRow(['Title','IMDb','Audience','Tomatoes','Raw','Host 1 Seen','Host 2 Seen','Host 3 Seen','Host 4 Seen','Unseen Multi','Residual Score','Helper','IMDb URL','Year','Metacritic','Letterboxd']);
  c.addRow(['Candidate A',80,90,100,'bad helper','Yes',' No ','', 'no',2,24500*1.025**2+0.00002,'Candidate A','https://www.imdb.com/title/tt0000001/',2000,75,80]);
  c.addRow(['Candidate A',80,85,100,null,'Yes','No','No','No',3,null]); c.addRow(['Title only']);
  o.addRow(['Title']);o.addRow(['Candidate A']);o.addRow(['Candidate A']);h.addRow(['Title']);h.addRow(['Film A']);h.addRow(['Old alias']);
  return w;
}
const config={memberIds: ['m1','m2','m3','m4']};
describe('safe spreadsheet plan',() => {
  it('requires regenerated exact slot-1 dates without changing Watch Order or identities',() => {
    const {plan}=analyseWorkbook(fixture(),config);
    expect(rawPlanSchema.safeParse(plan).success).toBe(true);
    const oldPlan={...plan,events:plan.events.map(e=>({...e,date_precision:'cycle_rough'}))};
    expect(rawPlanSchema.safeParse(oldPlan).success).toBe(false);
    expect(plan.rawWatchOrder.exactMatch).toBe(true);
    expect(analyseWorkbook(fixture(),config).plan.events.map(e=>e.id)).toEqual(plan.events.map(e=>e.id));
  });
  it('parses cycles, merged followers, slots and ordered appearances',() => {
    const {plan,summary}=analyseWorkbook(fixture(),config);
    expect(plan.cycles).toHaveLength(2);expect(plan.events).toHaveLength(9);expect(summary.counts.hostedAppearances).toBe(11);
    expect(plan.events.find(e=>e.cycle_slot===3)!.films.map(f=>f.position)).toEqual([1,2,3]);
    expect(plan.events.find(e=>e.kind==='classics')).toMatchObject({host_member_id: null,date_precision: 'cycle_rough'});
    expect(plan.events.filter(e=>e.cycle_slot===1).every(e=>e.date_precision==='exact' && e.event_date===plan.cycles.find(c=>c.id===e.cycle_id)!.rough_date)).toBe(true);
    expect(plan.events.filter(e=>e.cycle_slot>1).every(e=>e.date_precision==='cycle_rough')).toBe(true);
    expect(summary.watchOrder.exactMatch).toBe(true);
    expect(summary.ancillary).toHaveLength(1);expect(plan.movies.some(m=>m.title==='Ancillary')).toBe(false);
    expect(summary.helper).toMatchObject({overlap: 1});expect(plan.movies.some(m=>m.title==='Old alias')).toBe(false);
  });
  it('preserves titles, score provenance, seeds, Unknown and conflicting duplicates',() => {
    const {plan,summary}=analyseWorkbook(fixture(),config);expect(plan.classics.map(c=>c.rank_seed)).toEqual([2,3,4]);
    expect(plan.classics[0].seen.map(s=>s.seen)).toEqual([1,0,0]);expect(plan.classics[0].scores).toHaveLength(5);
    expect(plan.classics[0].scores[0]).toMatchObject({retrieved_via: 'legacy-spreadsheet',raw_scale: 100,fetched_at: null});
    expect(plan.classics[2].scores).toEqual([]);expect(plan.classics[2].seen).toEqual([]);
    expect(plan.classics[0].movie_id).not.toBe(plan.classics[1].movie_id);
    for(const code of ['WHITESPACE_NORMALISED','MALFORMED_HELPER','UNKNOWN_SEEN','DUPLICATE_TITLE','SNAPSHOT_COUNT_DRIFT']) expect(summary.diagnostics.some(d=>d.code===code)).toBe(true);
    expect(summary.reconciliation.some(r=>r.status==='duplicate/conflict' && r.reason.includes('conflicting'))).toBe(true);
  });
  it('supports headerless rank/title Watch Order and cached formulas without evaluation',() => {
    const w=fixture(); w.removeWorksheet(w.getWorksheet('Watch Order')!.id); const o=w.addWorksheet('Watch Order');
    o.addRow(['#1',{formula: 'untrusted()',result: 'Candidate A'}]);o.addRow(['#2','Candidate A']);
    expect(analyseWorkbook(w,config).summary.watchOrder.exactMatch).toBe(true);
  });
  it('produces deterministic output after an XLSX round trip',async () => {
    const w=fixture(), copy=new ExcelJS.Workbook();await copy.xlsx.load(await w.xlsx.writeBuffer());
    expect(analyseWorkbook(copy,config)).toEqual(analyseWorkbook(w,config));
  });
  it('only links verified-format identical IDs and exposes duplicated membership rows',() => {
    const w=fixture();w.getWorksheet('Should Watch')!.getCell('M3').value='https://imdb.com/title/tt0000001/';
    const {plan}=analyseWorkbook(w,config);expect(plan.classics[0].movie_id).toBe(plan.classics[1].movie_id);expect(plan.classics).toHaveLength(3);
    expect(plan.reconciliation.some(r=>r.status==='confidently-linked')).toBe(true);
  });
  it('rejects missing sheets, invalid dates/layouts and duplicate member IDs',() => {
    expect(()=>analyseWorkbook(new ExcelJS.Workbook(),config)).toThrow('Missing');
    const w=fixture();w.getWorksheet('Tracker')!.getCell('A5').value='2001-02-30';expect(()=>analyseWorkbook(w,config)).toThrow('Invalid cycle date');
    expect(configSchema.safeParse({memberIds:['a','a','c','d']}).success).toBe(false);
  });
});

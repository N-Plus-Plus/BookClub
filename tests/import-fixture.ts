import ExcelJS from 'exceljs';
export const config={memberIds:['club-member-1','club-member-2','club-member-3','club-member-4'],importSource:'legacy-spreadsheet',snapshotCapturedAt:'2002-01-01T00:00:00Z'};
export function workbook() {
 const w=new ExcelJS.Workbook(),t=w.addWorksheet('Tracker'),c=w.addWorksheet('Should Watch'),o=w.addWorksheet('Watch Order');w.addWorksheet('Sheet2').addRow(['Title']);
 t.addRow(['Date','Host 1','Host 2','Host 3','Host 4','Classics','Not Book Club']);t.addRow(['2001-01-01','Fictional Lantern','Fictional Bay','Fictional Vale','Fictional Marsh']);t.addRow([null,'Fictional Lantern']);
 c.addRow(['Title','IMDb','Audience','Tomatoes','Raw','Seen','Seen','Seen','Seen','Count','Residual','Helper','IMDb URL','Year','Metacritic','Letterboxd']);
 c.addRow(['Fictional Lantern',80,90,70,null,'Yes','No',null,'No',null,null,null,'https://imdb.com/title/tt0000001/',2000,' N/a ',80]);
 c.addRow(['Fictional Lantern',80,85,70,null,'Yes',null,'No','No',null,null,null,'https://imdb.com/title/tt0000001/',2000,70,'N/A']);
 c.addRow(['Fictional Seed']);o.addRow(['Title']);o.addRow(['Fictional Lantern']);o.addRow(['Fictional Lantern']);return w;
}

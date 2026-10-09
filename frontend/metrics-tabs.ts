export const metricsTabs = [
  {id:'top-bottom',label:'Top 5',metrics:['U','V','W','G','genre-combinations','H','I','L']},
  {id:'fingerprints',label:'Tastes',metrics:['C','F','S','R','P','O']},
  {id:'general',label:'Breakdowns',metrics:['B','T','K','Y','D','M','N']},
  {id:'extremes',label:'Records',metrics:['X']},
] as const;
export type MetricsTab = typeof metricsTabs[number]['id'];

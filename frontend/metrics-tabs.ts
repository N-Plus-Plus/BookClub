export const metricsTabs = [
  {id:'top-bottom',label:'Top 5',metrics:['U','V','W','G','J','L','H','I']},
  {id:'fingerprints',label:'Tastes',metrics:['C','F','O','P','R','S']},
  {id:'general',label:'Breakdowns',metrics:['B','D','Y','K','M','N','T']},
  {id:'extremes',label:'Records',metrics:['X']},
] as const;
export type MetricsTab = typeof metricsTabs[number]['id'];

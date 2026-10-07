export const metricsTabs = [
  {id:'top-bottom',label:'Top / Bottom',metrics:['E','U','V','W']},
  {id:'fingerprints',label:'Fingerprints',metrics:['C','F','G','J']},
  {id:'general',label:'General',metrics:['B','D','K','Y','L']},
  {id:'averages',label:'Averages',metrics:['M','N','T']},
  {id:'diversity',label:'Diversity',metrics:['O','P','Q','R','S']},
  {id:'standalone',label:'Standalone',metrics:['H','I']},
  {id:'extremes',label:'Extremes',metrics:['X']},
] as const;
export type MetricsTab = typeof metricsTabs[number]['id'];
